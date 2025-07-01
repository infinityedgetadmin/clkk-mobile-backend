import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
  BatchGetCommand,
  BatchWriteCommand,
  TransactWriteCommand,
  TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import {
  TABLE_NAME,
  ATTRIBUTES,
  INDEXES,
  QUERY_BUILDERS,
} from '@clkk/constants-layer';
import { logger, tracer, metrics, docClient, logMetric } from '@clkk/powertools-layer';
import { BaseEntity } from '@clkk/entities-layer';
import { createNextToken, parsePaginationParams, PaginationParams } from '@clkk/common-layer';

/**
 * Base Repository for data access patterns
 * Separates data access logic from business logic
 */
export abstract class BaseRepository<T extends BaseEntity> {
  protected static docClient: DynamoDBDocumentClient = docClient;
  protected static tableName: string = TABLE_NAME;
  
  constructor(protected entityConstructor: new (data?: Partial<T>) => T) {}

  /**
   * Query by GSI with pagination
   */
  protected async queryByIndex(
    indexName: string,
    keyCondition: { expression: string; values: Record<string, any> },
    options?: {
      sortKeyCondition?: { expression: string; values: Record<string, any> };
      filter?: { expression: string; values: Record<string, any> };
      pagination?: PaginationParams;
      scanIndexForward?: boolean;
      projectionExpression?: string;
    }
  ): Promise<{
    items: T[];
    nextToken?: string;
    count: number;
  }> {
    const segment = tracer.getSegment();
    const subsegment = segment?.addNewSubsegment('DynamoDB::QueryByIndex');
    
    try {
      const paginationParams = parsePaginationParams(options?.pagination || {});
      
      // Build key condition expression
      let keyConditionExpression = keyCondition.expression;
      let expressionAttributeValues = { ...keyCondition.values };
      
      if (options?.sortKeyCondition) {
        keyConditionExpression += ` AND ${options.sortKeyCondition.expression}`;
        expressionAttributeValues = {
          ...expressionAttributeValues,
          ...options.sortKeyCondition.values,
        };
      }
      
      const params: QueryCommandInput = {
        TableName: BaseRepository.tableName,
        IndexName: indexName,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ...paginationParams,
        ScanIndexForward: options?.scanIndexForward ?? false,
      };
      
      // Add filter expression if provided
      if (options?.filter) {
        params.FilterExpression = options.filter.expression;
        params.ExpressionAttributeValues = {
          ...params.ExpressionAttributeValues,
          ...options.filter.values,
        };
      }
      
      // Add projection expression if provided
      if (options?.projectionExpression) {
        params.ProjectionExpression = options.projectionExpression;
      }
      
      logger.info('Querying by index', {
        indexName,
        keyCondition: keyCondition.expression,
        hasFilter: !!options?.filter,
      });
      
      const result = await BaseRepository.docClient.send(new QueryCommand(params));
      
      const items: T[] = [];
      if (result.Items) {
        for (const item of result.Items) {
          const entity = new this.entityConstructor();
          Object.assign(entity, entity['fromItem'](item));
          items.push(entity);
        }
      }
      
      logMetric(`${this.constructor.name}QueryByIndex`, 1);
      logMetric(`${this.constructor.name}QueryItemCount`, items.length);
      
      return {
        items,
        nextToken: createNextToken(result.LastEvaluatedKey),
        count: result.Count || 0,
      };
      
    } catch (error) {
      logger.error('Failed to query by index', error as Error, {
        indexName,
        repositoryType: this.constructor.name,
      });
      
      logMetric(`${this.constructor.name}QueryError`, 1);
      throw error;
    } finally {
      subsegment?.close();
    }
  }

  /**
   * Batch get multiple items
   */
  protected async batchGet(keys: Record<string, any>[]): Promise<T[]> {
    const segment = tracer.getSegment();
    const subsegment = segment?.addNewSubsegment('DynamoDB::BatchGet');
    
    try {
      // DynamoDB batch get limit is 100 items
      const chunks = this.chunkArray(keys, 100);
      const allItems: T[] = [];
      
      for (const chunk of chunks) {
        const params = {
          RequestItems: {
            [BaseRepository.tableName]: {
              Keys: chunk,
            },
          },
        };
        
        const result = await BaseRepository.docClient.send(new BatchGetCommand(params));
        
        if (result.Responses?.[BaseRepository.tableName]) {
          for (const item of result.Responses[BaseRepository.tableName]) {
            const entity = new this.entityConstructor();
            Object.assign(entity, entity['fromItem'](item));
            allItems.push(entity);
          }
        }
        
        // Handle unprocessed keys
        if (result.UnprocessedKeys?.[BaseRepository.tableName]) {
          logger.warn('Unprocessed keys in batch get', {
            count: result.UnprocessedKeys[BaseRepository.tableName].Keys?.length,
          });
        }
      }
      
      logMetric(`${this.constructor.name}BatchGet`, 1);
      logMetric(`${this.constructor.name}BatchGetItemCount`, allItems.length);
      
      return allItems;
      
    } catch (error) {
      logger.error('Failed to batch get items', error as Error);
      logMetric(`${this.constructor.name}BatchGetError`, 1);
      throw error;
    } finally {
      subsegment?.close();
    }
  }

  /**
   * Batch write multiple items
   */
  protected async batchWrite(entities: T[]): Promise<void> {
    const segment = tracer.getSegment();
    const subsegment = segment?.addNewSubsegment('DynamoDB::BatchWrite');
    
    try {
      // DynamoDB batch write limit is 25 items
      const chunks = this.chunkArray(entities, 25);
      
      for (const chunk of chunks) {
        const putRequests = chunk.map(entity => ({
          PutRequest: {
            Item: {
              ...entity.getPrimaryKey(),
              ...entity.toItem(),
              [ATTRIBUTES.CREATED_AT]: entity.createdAt || new Date().toISOString(),
              [ATTRIBUTES.UPDATED_AT]: new Date().toISOString(),
            },
          },
        }));
        
        const params = {
          RequestItems: {
            [BaseRepository.tableName]: putRequests,
          },
        };
        
        const result = await BaseRepository.docClient.send(new BatchWriteCommand(params));
        
        // Handle unprocessed items
        if (result.UnprocessedItems?.[BaseRepository.tableName]) {
          logger.warn('Unprocessed items in batch write', {
            count: result.UnprocessedItems[BaseRepository.tableName].length,
          });
          // Could implement retry logic here
        }
      }
      
      logMetric(`${this.constructor.name}BatchWrite`, 1);
      logMetric(`${this.constructor.name}BatchWriteItemCount`, entities.length);
      
    } catch (error) {
      logger.error('Failed to batch write items', error as Error);
      logMetric(`${this.constructor.name}BatchWriteError`, 1);
      throw error;
    } finally {
      subsegment?.close();
    }
  }

  /**
   * Transaction write for atomic operations
   */
  protected async transactWrite(items: TransactWriteCommandInput['TransactItems']): Promise<void> {
    const segment = tracer.getSegment();
    const subsegment = segment?.addNewSubsegment('DynamoDB::TransactWrite');
    
    try {
      const params: TransactWriteCommandInput = {
        TransactItems: items,
      };
      
      await BaseRepository.docClient.send(new TransactWriteCommand(params));
      
      logMetric(`${this.constructor.name}TransactWrite`, 1);
      
    } catch (error) {
      logger.error('Failed to execute transaction', error as Error);
      logMetric(`${this.constructor.name}TransactWriteError`, 1);
      throw error;
    } finally {
      subsegment?.close();
    }
  }

  /**
   * Helper to chunk arrays for batch operations
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Query all pages of results
   */
  protected async queryAllPages(
    indexName: string,
    keyCondition: { expression: string; values: Record<string, any> },
    options?: {
      sortKeyCondition?: { expression: string; values: Record<string, any> };
      filter?: { expression: string; values: Record<string, any> };
      maxItems?: number;
    }
  ): Promise<T[]> {
    const allItems: T[] = [];
    let nextToken: string | undefined;
    const maxItems = options?.maxItems || 1000; // Default max to prevent runaway queries
    
    do {
      const result = await this.queryByIndex(indexName, keyCondition, {
        ...options,
        pagination: {
          limit: Math.min(100, maxItems - allItems.length),
          nextToken,
        },
      });
      
      allItems.push(...result.items);
      nextToken = result.nextToken;
      
      // Stop if we've reached the max items
      if (allItems.length >= maxItems) {
        break;
      }
    } while (nextToken);
    
    return allItems.slice(0, maxItems);
  }

  /**
   * Count items by index
   */
  protected async countByIndex(
    indexName: string,
    keyCondition: { expression: string; values: Record<string, any> },
    options?: {
      sortKeyCondition?: { expression: string; values: Record<string, any> };
      filter?: { expression: string; values: Record<string, any> };
    }
  ): Promise<number> {
    let count = 0;
    let nextToken: string | undefined;
    
    do {
      const params: QueryCommandInput = {
        TableName: BaseRepository.tableName,
        IndexName: indexName,
        KeyConditionExpression: keyCondition.expression,
        ExpressionAttributeValues: keyCondition.values,
        Select: 'COUNT',
        ExclusiveStartKey: nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined,
      };
      
      if (options?.sortKeyCondition) {
        params.KeyConditionExpression += ` AND ${options.sortKeyCondition.expression}`;
        params.ExpressionAttributeValues = {
          ...params.ExpressionAttributeValues,
          ...options.sortKeyCondition.values,
        };
      }
      
      if (options?.filter) {
        params.FilterExpression = options.filter.expression;
        params.ExpressionAttributeValues = {
          ...params.ExpressionAttributeValues,
          ...options.filter.values,
        };
      }
      
      const result = await BaseRepository.docClient.send(new QueryCommand(params));
      count += result.Count || 0;
      nextToken = createNextToken(result.LastEvaluatedKey);
    } while (nextToken);
    
    return count;
  }
}