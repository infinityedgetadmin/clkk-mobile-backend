import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  UpdateCommand, 
  DeleteCommand,
  PutCommandInput,
  GetCommandInput,
  UpdateCommandInput,
  DeleteCommandInput
} from '@aws-sdk/lib-dynamodb';
import { 
  TABLE_NAME, 
  ATTRIBUTES, 
  UPDATE_BUILDERS, 
  CONDITION_BUILDERS 
} from '@clkk/constants-layer';
import { logger, tracer, metrics, docClient, logMetric } from '@clkk/powertools-layer';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';

/**
 * Base Entity class with common database operations
 * All entities should extend this class for consistent behavior
 */
export abstract class BaseEntity {
  protected static docClient: DynamoDBDocumentClient = docClient;
  protected static tableName: string = TABLE_NAME;
  
  // Common fields for all entities
  id!: string;
  createdAt!: string;
  updatedAt!: string;
  
  constructor(data?: Partial<BaseEntity>) {
    if (data) {
      Object.assign(this, data);
    }
  }

  /**
   * Abstract methods that must be implemented by child classes
   */
  abstract getPrimaryKey(): Record<string, string>;
  abstract toItem(): Record<string, any>;
  abstract validate(): void;
  
  /**
   * Convert entity to GraphQL type (optional override)
   */
  toGraphQLType?(): any;

  /**
   * Save entity to database (create or update)
   */
  async save(): Promise<void> {
    const segment = tracer.getSegment();
    const subsegment = segment?.addNewSubsegment('DynamoDB::SaveEntity');
    
    try {
      // Validate before saving
      this.validate();
      
      // Set timestamps
      const now = new Date().toISOString();
      if (!this.createdAt) {
        this.createdAt = now;
      }
      this.updatedAt = now;
      
      const item = {
        ...this.getPrimaryKey(),
        ...this.toItem(),
        [ATTRIBUTES.CREATED_AT]: this.createdAt,
        [ATTRIBUTES.UPDATED_AT]: this.updatedAt,
      };
      
      const params: PutCommandInput = {
        TableName: BaseEntity.tableName,
        Item: item,
      };
      
      logger.info('Saving entity', {
        entityType: this.constructor.name,
        id: this.id,
      });
      
      await BaseEntity.docClient.send(new PutCommand(params));
      
      logMetric(`${this.constructor.name}Saved`, 1);
      
    } catch (error) {
      logger.error('Failed to save entity', error as Error, {
        entityType: this.constructor.name,
        id: this.id,
      });
      
      logMetric(`${this.constructor.name}SaveError`, 1);
      throw error;
    } finally {
      subsegment?.close();
    }
  }

  /**
   * Create entity with existence check
   */
  async create(): Promise<void> {
    const segment = tracer.getSegment();
    const subsegment = segment?.addNewSubsegment('DynamoDB::CreateEntity');
    
    try {
      // Validate before creating
      this.validate();
      
      // Set timestamps
      const now = new Date().toISOString();
      this.createdAt = now;
      this.updatedAt = now;
      
      const item = {
        ...this.getPrimaryKey(),
        ...this.toItem(),
        [ATTRIBUTES.CREATED_AT]: this.createdAt,
        [ATTRIBUTES.UPDATED_AT]: this.updatedAt,
      };
      
      // Use condition to ensure item doesn't exist
      const condition = CONDITION_BUILDERS.attributeNotExists(ATTRIBUTES.PARTITION_KEY);
      
      const params: PutCommandInput = {
        TableName: BaseEntity.tableName,
        Item: item,
        ...condition,
      };
      
      logger.info('Creating new entity', {
        entityType: this.constructor.name,
        id: this.id,
      });
      
      await BaseEntity.docClient.send(new PutCommand(params));
      
      logMetric(`${this.constructor.name}Created`, 1);
      
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        logger.warn('Entity already exists', {
          entityType: this.constructor.name,
          id: this.id,
        });
        throw new Error(`${this.constructor.name} with id ${this.id} already exists`);
      }
      
      logger.error('Failed to create entity', error as Error, {
        entityType: this.constructor.name,
        id: this.id,
      });
      
      logMetric(`${this.constructor.name}CreateError`, 1);
      throw error;
    } finally {
      subsegment?.close();
    }
  }

  /**
   * Update entity with optimistic locking
   */
  async update(updates: Record<string, any>): Promise<void> {
    const segment = tracer.getSegment();
    const subsegment = segment?.addNewSubsegment('DynamoDB::UpdateEntity');
    
    try {
      const updateExpression = UPDATE_BUILDERS.set(updates);
      
      const params: UpdateCommandInput = {
        TableName: BaseEntity.tableName,
        Key: this.getPrimaryKey(),
        ...updateExpression,
        ReturnValues: 'ALL_NEW',
      };
      
      logger.info('Updating entity', {
        entityType: this.constructor.name,
        id: this.id,
        updates: Object.keys(updates),
      });
      
      const result = await BaseEntity.docClient.send(new UpdateCommand(params));
      
      // Update local instance with new values
      if (result.Attributes) {
        Object.assign(this, this.fromItem(result.Attributes));
      }
      
      logMetric(`${this.constructor.name}Updated`, 1);
      
    } catch (error) {
      logger.error('Failed to update entity', error as Error, {
        entityType: this.constructor.name,
        id: this.id,
      });
      
      logMetric(`${this.constructor.name}UpdateError`, 1);
      throw error;
    } finally {
      subsegment?.close();
    }
  }

  /**
   * Delete entity from database
   */
  async delete(): Promise<void> {
    const segment = tracer.getSegment();
    const subsegment = segment?.addNewSubsegment('DynamoDB::DeleteEntity');
    
    try {
      const params: DeleteCommandInput = {
        TableName: BaseEntity.tableName,
        Key: this.getPrimaryKey(),
      };
      
      logger.info('Deleting entity', {
        entityType: this.constructor.name,
        id: this.id,
      });
      
      await BaseEntity.docClient.send(new DeleteCommand(params));
      
      logMetric(`${this.constructor.name}Deleted`, 1);
      
    } catch (error) {
      logger.error('Failed to delete entity', error as Error, {
        entityType: this.constructor.name,
        id: this.id,
      });
      
      logMetric(`${this.constructor.name}DeleteError`, 1);
      throw error;
    } finally {
      subsegment?.close();
    }
  }

  /**
   * Get entity by primary key
   */
  protected static async getByKey<T extends BaseEntity>(
    this: new () => T,
    key: Record<string, string>
  ): Promise<T | null> {
    const segment = tracer.getSegment();
    const subsegment = segment?.addNewSubsegment('DynamoDB::GetEntity');
    
    try {
      const params: GetCommandInput = {
        TableName: BaseEntity.tableName,
        Key: key,
      };
      
      logger.info('Getting entity by key', {
        entityType: this.name,
        key,
      });
      
      const result = await BaseEntity.docClient.send(new GetCommand(params));
      
      if (!result.Item) {
        return null;
      }
      
      const instance = new this();
      return Object.assign(instance, instance.fromItem(result.Item)) as T;
      
    } catch (error) {
      logger.error('Failed to get entity', error as Error, {
        entityType: this.name,
        key,
      });
      
      throw error;
    } finally {
      subsegment?.close();
    }
  }

  /**
   * Abstract method to convert DynamoDB item to entity instance
   * Must be implemented by child classes
   */
  protected abstract fromItem(item: Record<string, any>): Partial<this>;

  /**
   * Batch get multiple entities
   */
  protected static async batchGet<T extends BaseEntity>(
    this: new () => T,
    keys: Record<string, string>[]
  ): Promise<T[]> {
    // Implementation for batch operations
    // This would use BatchGetCommand for efficiency
    const results: T[] = [];
    
    // For now, simple implementation
    for (const key of keys) {
      const item = await this.getByKey<T>(key);
      if (item) {
        results.push(item);
      }
    }
    
    return results;
  }

  /**
   * Helper to check if entity exists
   */
  async exists(): Promise<boolean> {
    try {
      const params: GetCommandInput = {
        TableName: BaseEntity.tableName,
        Key: this.getPrimaryKey(),
        ProjectionExpression: ATTRIBUTES.PARTITION_KEY,
      };
      
      const result = await BaseEntity.docClient.send(new GetCommand(params));
      return !!result.Item;
    } catch (error) {
      logger.error('Failed to check entity existence', error as Error);
      return false;
    }
  }
}