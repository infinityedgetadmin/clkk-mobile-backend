import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';
import { AppConfigProvider } from '@aws-lambda-powertools/parameters/appconfig';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { AppSyncIdentityCognito, AppSyncIdentityIAM } from 'aws-lambda';

// Initialize with service name from environment
const serviceName = process.env.POWERTOOLS_SERVICE_NAME || 'clkk-backend';
const environment = process.env.ENVIRONMENT || 'dev';

// Logger configuration
export const logger = new Logger({
  serviceName,
  environment,
  sampleRateValue: process.env.ENVIRONMENT === 'prod' ? 0.1 : 1,
  persistentLogAttributes: {
    environment,
    region: process.env.AWS_REGION || 'us-east-1',
    version: process.env.FUNCTION_VERSION || '$LATEST',
  },
});

// Tracer configuration
export const tracer = new Tracer({
  serviceName,
  captureHTTPsRequests: true,
});

// Metrics configuration
export const metrics = new Metrics({
  namespace: 'CLKK',
  serviceName,
  defaultDimensions: {
    environment,
  },
});

// AppConfig provider for feature flags and configuration
export const appConfigProvider = new AppConfigProvider({
  environment,
});

// DynamoDB client with X-Ray tracing
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
});

// Capture AWS SDK v3 client
export const docClient = DynamoDBDocumentClient.from(
  tracer.captureAWSv3Client(dynamoClient),
  {
    marshallOptions: {
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
  }
);

// GraphQL Context type
export interface GraphQLContext {
  logger: Logger;
  tracer: Tracer;
  metrics: Metrics;
  docClient: DynamoDBDocumentClient;
  identity: AppSyncIdentityCognito | AppSyncIdentityIAM | null;
  requestId: string;
  environment: string;
}

// Middleware configuration object
export const powertoolsConfig = {
  logger,
  tracer,
  metrics,
  docClient,
};

// Error types
export class ValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

// Utility functions
export const addCorrelationId = (correlationId: string) => {
  logger.appendKeys({ correlationId });
  tracer.putAnnotation('correlationId', correlationId);
};

export const logMetric = (
  name: string,
  value: number = 1,
  unit: MetricUnits = MetricUnits.Count
) => {
  metrics.addMetric(name, unit, value);
};

// Common middleware configuration
export const createLambdaContext = (event: any, context: any): GraphQLContext => {
  const requestId = context.requestId || event.request?.headers?.['x-amzn-trace-id'];
  
  // Add correlation ID
  if (requestId) {
    addCorrelationId(requestId);
  }

  return {
    logger,
    tracer,
    metrics,
    docClient,
    identity: event.identity || null,
    requestId,
    environment,
  };
};