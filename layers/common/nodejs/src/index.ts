import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// ID generation utilities
export const generateId = (prefix?: string): string => {
  const id = uuidv4();
  return prefix ? `${prefix}_${id}` : id;
};

export const generateUserId = (): string => generateId('user');
export const generateTransactionId = (): string => generateId('txn');
export const generateWalletId = (): string => generateId('wallet');

// Single table design keys
export const TableKeys = {
  user: (userId: string) => ({
    PK: `USER#${userId}`,
    SK: `USER#${userId}`,
  }),
  
  userByClerkId: (clerkId: string) => ({
    ExternalIdKey: `CLERK#${clerkId}`,
  }),
  
  userByEmail: (email: string) => ({
    EmailKey: `EMAIL#${email.toLowerCase()}`,
  }),
  
  userByClkkTag: (clkkTag: string) => ({
    ClkkTagKey: `TAG#${clkkTag.toLowerCase()}`,
  }),
  
  wallet: (userId: string, walletId: string) => ({
    PK: `USER#${userId}`,
    SK: `WALLET#${walletId}`,
  }),
  
  transaction: (userId: string, timestamp: string, transactionId: string) => ({
    PK: `USER#${userId}`,
    SK: `TXN#${timestamp}#${transactionId}`,
  }),
  
  kycDocument: (userId: string, documentId: string) => ({
    PK: `USER#${userId}`,
    SK: `KYC#DOC#${documentId}`,
  }),
};

// Common validation schemas
export const commonSchemas = {
  email: z.string().email().toLowerCase(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  uuid: z.string().uuid(),
  timestamp: z.string().datetime(),
  money: z.object({
    amount: z.number().int().min(0),
    currency: z.enum(['USD', 'EUR', 'GBP']),
  }),
};

// Date utilities
export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

export const getUnixTimestamp = (): number => {
  return Math.floor(Date.now() / 1000);
};

// Error handling utilities
export const createErrorResponse = (error: Error, statusCode: number = 500) => {
  return {
    statusCode,
    body: JSON.stringify({
      error: error.name,
      message: error.message,
      timestamp: getCurrentTimestamp(),
    }),
  };
};

// DynamoDB utilities
export const buildUpdateExpression = (updates: Record<string, any>) => {
  const expressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.entries(updates).forEach(([key, value], index) => {
    if (value !== undefined) {
      const placeholder = `#attr${index}`;
      const valuePlaceholder = `:val${index}`;
      
      expressions.push(`${placeholder} = ${valuePlaceholder}`);
      expressionAttributeNames[placeholder] = key;
      expressionAttributeValues[valuePlaceholder] = value;
    }
  });

  return {
    UpdateExpression: `SET ${expressions.join(', ')}, #updatedAt = :updatedAt`,
    ExpressionAttributeNames: {
      ...expressionAttributeNames,
      '#updatedAt': 'updatedAt',
    },
    ExpressionAttributeValues: {
      ...expressionAttributeValues,
      ':updatedAt': getCurrentTimestamp(),
    },
  };
};

// Response utilities
export const createSuccessResponse = <T>(data: T) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data,
      timestamp: getCurrentTimestamp(),
    }),
  };
};

// Pagination utilities
export interface PaginationParams {
  limit?: number;
  nextToken?: string;
}

export const parsePaginationParams = (params: PaginationParams) => {
  return {
    Limit: params.limit || 20,
    ExclusiveStartKey: params.nextToken 
      ? JSON.parse(Buffer.from(params.nextToken, 'base64').toString()) 
      : undefined,
  };
};

export const createNextToken = (lastEvaluatedKey: any): string | undefined => {
  if (!lastEvaluatedKey) return undefined;
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64');
};

// Retry utilities
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 100
): Promise<T> => {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError!;
};

// String utilities
export const sanitizeString = (str: string): string => {
  return str.trim().replace(/[^\w\s-]/g, '');
};

export const generateClkkTag = (firstName: string, lastName: string): string => {
  const sanitizedFirst = sanitizeString(firstName).toLowerCase();
  const sanitizedLast = sanitizeString(lastName).toLowerCase();
  const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `${sanitizedFirst}${sanitizedLast}${randomNum}`;
};