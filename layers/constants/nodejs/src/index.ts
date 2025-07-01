/**
 * Constants Layer - All DynamoDB constants in one place
 * NO HARDCODED STRINGS in any other layer should reference DB attributes
 */

// Table name from environment
export const TABLE_NAME = process.env.TABLE_NAME || 'clkk-backend-app-table';

// DynamoDB Attribute Names
export const ATTRIBUTES = {
  // Primary Key Attributes
  PARTITION_KEY: 'PK',
  SORT_KEY: 'SK',
  
  // GSI Key Attributes
  EXTERNAL_ID_KEY: 'ExternalIdKey',
  EMAIL_KEY: 'EmailKey',
  CLKK_TAG_KEY: 'ClkkTagKey',
  TIME_SORT_KEY: 'TimeSortKey',
  TYPE_STATUS_KEY: 'TypeStatusKey',
  
  // Entity Attributes
  ID: 'id',
  TYPE: 'type',
  STATUS: 'status',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  
  // User Attributes
  CLERK_ID: 'clerkId',
  EMAIL: 'email',
  PHONE_NUMBER: 'phoneNumber',
  FIRST_NAME: 'firstName',
  LAST_NAME: 'lastName',
  CLKK_TAG: 'clkkTag',
  KYC_STATUS: 'kycStatus',
  KYC_DETAILS: 'kycDetails',
  PROFILE_IMAGE_URL: 'profileImageUrl',
  DATE_OF_BIRTH: 'dateOfBirth',
  ADDRESS: 'address',
  METADATA: 'metadata',
  
  // Transaction Attributes
  USER_ID: 'userId',
  WALLET_ID: 'walletId',
  AMOUNT: 'amount',
  CURRENCY: 'currency',
  DESCRIPTION: 'description',
  SENDER_ID: 'senderId',
  SENDER_TYPE: 'senderType',
  SENDER_NAME: 'senderName',
  RECEIVER_ID: 'receiverId',
  RECEIVER_TYPE: 'receiverType',
  RECEIVER_NAME: 'receiverName',
  BALANCE_BEFORE: 'balanceBefore',
  BALANCE_AFTER: 'balanceAfter',
  COMPLETED_AT: 'completedAt',
  
  // Wallet Attributes
  BALANCE: 'balance',
  WALLET_TYPE: 'walletType',
  WALLET_STATUS: 'walletStatus',
} as const;

// Global Secondary Index Names
export const INDEXES = {
  EXTERNAL_ID: 'ExternalIdIndex',
  EMAIL: 'EmailIndex',
  CLKK_TAG: 'ClkkTagIndex',
  TIME_SORT: 'TimeSortIndex',
  TYPE_STATUS: 'TypeStatusIndex',
} as const;

// Entity Type Prefixes
export const ENTITY_PREFIXES = {
  USER: 'USER',
  WALLET: 'WALLET',
  TRANSACTION: 'TXN',
  KYC_DOCUMENT: 'KYC#DOC',
  EXTERNAL_ACCOUNT: 'EXT_ACCOUNT',
  CLERK: 'CLERK',
  EMAIL: 'EMAIL',
  TAG: 'TAG',
  DATE: 'DATE',
} as const;

// Key Builders
export const KEY_BUILDERS = {
  // User Keys
  user: (userId: string) => ({
    [ATTRIBUTES.PARTITION_KEY]: `${ENTITY_PREFIXES.USER}#${userId}`,
    [ATTRIBUTES.SORT_KEY]: `${ENTITY_PREFIXES.USER}#${userId}`,
  }),
  
  userByClerkId: (clerkId: string) => ({
    [ATTRIBUTES.EXTERNAL_ID_KEY]: `${ENTITY_PREFIXES.CLERK}#${clerkId}`,
  }),
  
  userByEmail: (email: string) => ({
    [ATTRIBUTES.EMAIL_KEY]: `${ENTITY_PREFIXES.EMAIL}#${email.toLowerCase()}`,
  }),
  
  userByClkkTag: (clkkTag: string) => ({
    [ATTRIBUTES.CLKK_TAG_KEY]: `${ENTITY_PREFIXES.TAG}#${clkkTag.toLowerCase()}`,
  }),
  
  // Wallet Keys
  wallet: (userId: string, walletId: string) => ({
    [ATTRIBUTES.PARTITION_KEY]: `${ENTITY_PREFIXES.USER}#${userId}`,
    [ATTRIBUTES.SORT_KEY]: `${ENTITY_PREFIXES.WALLET}#${walletId}`,
  }),
  
  // Transaction Keys
  transaction: (userId: string, timestamp: string, transactionId: string) => ({
    [ATTRIBUTES.PARTITION_KEY]: `${ENTITY_PREFIXES.USER}#${userId}`,
    [ATTRIBUTES.SORT_KEY]: `${ENTITY_PREFIXES.TRANSACTION}#${timestamp}#${transactionId}`,
  }),
  
  transactionByDate: (userId: string, date: string) => ({
    [ATTRIBUTES.PARTITION_KEY]: `${ENTITY_PREFIXES.USER}#${userId}`,
    [ATTRIBUTES.TIME_SORT_KEY]: `${ENTITY_PREFIXES.DATE}#${date}`,
  }),
  
  // KYC Document Keys
  kycDocument: (userId: string, documentId: string) => ({
    [ATTRIBUTES.PARTITION_KEY]: `${ENTITY_PREFIXES.USER}#${userId}`,
    [ATTRIBUTES.SORT_KEY]: `${ENTITY_PREFIXES.KYC_DOCUMENT}#${documentId}`,
  }),
} as const;

// Query Builders
export const QUERY_BUILDERS = {
  keyCondition: (attributeName: string, value: string) => ({
    expression: `${attributeName} = :value`,
    values: {
      ':value': value,
    },
  }),
  
  betweenCondition: (attributeName: string, start: string, end: string) => ({
    expression: `${attributeName} BETWEEN :start AND :end`,
    values: {
      ':start': start,
      ':end': end,
    },
  }),
  
  beginsWithCondition: (attributeName: string, prefix: string) => ({
    expression: `begins_with(${attributeName}, :prefix)`,
    values: {
      ':prefix': prefix,
    },
  }),
} as const;

// Update Expression Builders
export const UPDATE_BUILDERS = {
  set: (updates: Record<string, any>) => {
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

    // Always update the updatedAt timestamp
    const updatedAtPlaceholder = `#attr${Object.keys(updates).length}`;
    const updatedAtValuePlaceholder = `:val${Object.keys(updates).length}`;
    expressions.push(`${updatedAtPlaceholder} = ${updatedAtValuePlaceholder}`);
    expressionAttributeNames[updatedAtPlaceholder] = ATTRIBUTES.UPDATED_AT;
    expressionAttributeValues[updatedAtValuePlaceholder] = new Date().toISOString();

    return {
      UpdateExpression: `SET ${expressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    };
  },
  
  increment: (attribute: string, value: number) => ({
    UpdateExpression: `ADD #attr :val`,
    ExpressionAttributeNames: {
      '#attr': attribute,
    },
    ExpressionAttributeValues: {
      ':val': value,
    },
  }),
} as const;

// Condition Expression Builders
export const CONDITION_BUILDERS = {
  attributeExists: (attribute: string) => ({
    ConditionExpression: 'attribute_exists(#attr)',
    ExpressionAttributeNames: {
      '#attr': attribute,
    },
  }),
  
  attributeNotExists: (attribute: string) => ({
    ConditionExpression: 'attribute_not_exists(#attr)',
    ExpressionAttributeNames: {
      '#attr': attribute,
    },
  }),
  
  attributeEquals: (attribute: string, value: any) => ({
    ConditionExpression: '#attr = :value',
    ExpressionAttributeNames: {
      '#attr': attribute,
    },
    ExpressionAttributeValues: {
      ':value': value,
    },
  }),
} as const;

// Transaction Status Values
export const TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REVERSED: 'REVERSED',
} as const;

// Transaction Type Values
export const TRANSACTION_TYPE = {
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
  TRANSFER: 'TRANSFER',
  FEE: 'FEE',
  REFUND: 'REFUND',
} as const;

// KYC Status Values
export const KYC_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  PENDING: 'PENDING',
  IN_REVIEW: 'IN_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;

// Wallet Status Values
export const WALLET_STATUS = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  CLOSED: 'CLOSED',
} as const;

// Entity Type Values
export const ENTITY_TYPE = {
  USER: 'USER',
  ORGANIZATION: 'ORGANIZATION',
  SYSTEM: 'SYSTEM',
} as const;

// Type exports for TypeScript
export type TableAttributes = typeof ATTRIBUTES;
export type IndexNames = typeof INDEXES;
export type EntityPrefixes = typeof ENTITY_PREFIXES;
export type TransactionStatus = keyof typeof TRANSACTION_STATUS;
export type TransactionType = keyof typeof TRANSACTION_TYPE;
export type KycStatus = keyof typeof KYC_STATUS;
export type WalletStatus = keyof typeof WALLET_STATUS;
export type EntityType = keyof typeof ENTITY_TYPE;