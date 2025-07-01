import { AppSyncResolverHandler } from 'aws-lambda';
import middy from '@middy/core';
import { injectLambdaContext } from '@aws-lambda-powertools/logger';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer';
import { logMetrics } from '@aws-lambda-powertools/metrics';
import { 
  logger, 
  tracer, 
  metrics, 
  createLambdaContext,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  GraphQLContext
} from '@clkk/powertools-layer';

/**
 * Base Lambda handler with optimizations for cold starts
 * Provides common middleware and error handling
 */

// Pre-initialize middleware to reduce cold start
const baseMiddleware = middy()
  .use(injectLambdaContext(logger, { logEvent: false })) // Don't log full event in prod
  .use(captureLambdaHandler(tracer))
  .use(logMetrics(metrics));

/**
 * Error transformer for GraphQL responses
 */
export const transformError = (error: Error): Error => {
  logger.error('Lambda execution error', error);
  
  // Map domain errors to GraphQL errors
  if (error instanceof ValidationError) {
    return new Error(`Validation Error: ${error.message}`);
  }
  
  if (error instanceof NotFoundError) {
    return new Error(`Not Found: ${error.message}`);
  }
  
  if (error instanceof ConflictError) {
    return new Error(`Conflict: ${error.message}`);
  }
  
  if (error instanceof UnauthorizedError) {
    return new Error(`Unauthorized: ${error.message}`);
  }
  
  // Generic error (don't expose internals in production)
  if (process.env.ENVIRONMENT === 'prod') {
    return new Error('An error occurred processing your request');
  }
  
  return error;
};

/**
 * Create an optimized Lambda handler for AppSync resolvers
 * 
 * @param handler - The actual resolver logic
 * @param options - Handler options
 * @returns Middy-wrapped handler with all middleware
 */
export const createHandler = <TArgs = any, TResult = any>(
  handler: (
    event: Parameters<AppSyncResolverHandler<TArgs, TResult>>[0],
    context: GraphQLContext
  ) => Promise<TResult>,
  options?: {
    logEvent?: boolean;
    captureResponse?: boolean;
    timeoutWarningThreshold?: number;
  }
) => {
  const lambdaHandler: AppSyncResolverHandler<TArgs, TResult> = async (event, lambdaContext) => {
    // Create GraphQL context with all utilities
    const context = createLambdaContext(event, lambdaContext);
    
    // Set timeout warning
    const timeoutWarning = options?.timeoutWarningThreshold || 25000; // 25s default
    const timeoutTimer = setTimeout(() => {
      logger.warn('Lambda approaching timeout', {
        remainingTime: lambdaContext.getRemainingTimeInMillis(),
        functionName: lambdaContext.functionName,
      });
    }, timeoutWarning);
    
    try {
      // Log resolver invocation
      logger.info('Resolver invoked', {
        fieldName: event.info.fieldName,
        parentTypeName: event.info.parentTypeName,
        variables: event.info.variables,
      });
      
      // Execute the handler
      const result = await handler(event, context);
      
      // Log success
      logger.info('Resolver completed successfully', {
        fieldName: event.info.fieldName,
      });
      
      return result;
      
    } catch (error) {
      // Transform and throw error
      throw transformError(error as Error);
    } finally {
      clearTimeout(timeoutTimer);
    }
  };
  
  // Apply middleware with custom options
  return baseMiddleware
    .before(async (request) => {
      // Custom before logic if needed
      if (options?.logEvent) {
        logger.info('Full event', { event: request.event });
      }
    })
    .after(async (request) => {
      // Custom after logic if needed
      if (options?.captureResponse) {
        logger.info('Response', { response: request.response });
      }
    })
    .onError(async (request) => {
      // Error is already logged in the handler
      // This is for any additional error handling
    })
    .handler(lambdaHandler);
};

/**
 * Batch resolver handler for efficient processing
 */
export const createBatchHandler = <TArgs = any, TResult = any>(
  handler: (
    events: Array<Parameters<AppSyncResolverHandler<TArgs, TResult>>[0]>,
    context: GraphQLContext
  ) => Promise<TResult[]>,
  options?: {
    maxBatchSize?: number;
  }
) => {
  return createHandler<TArgs, TResult>(async (event, context) => {
    // For batch resolvers, AppSync sends multiple events
    // This is a placeholder for batch processing logic
    const results = await handler([event], context);
    return results[0];
  }, options);
};

/**
 * Cached resolver handler for frequently accessed data
 */
const resolverCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute default

export const createCachedHandler = <TArgs = any, TResult = any>(
  handler: (
    event: Parameters<AppSyncResolverHandler<TArgs, TResult>>[0],
    context: GraphQLContext
  ) => Promise<TResult>,
  options?: {
    ttl?: number;
    cacheKeyFn?: (event: any) => string;
  }
) => {
  return createHandler<TArgs, TResult>(async (event, context) => {
    const ttl = options?.ttl || CACHE_TTL;
    const cacheKey = options?.cacheKeyFn 
      ? options.cacheKeyFn(event)
      : `${event.info.parentTypeName}.${event.info.fieldName}:${JSON.stringify(event.arguments)}`;
    
    // Check cache
    const cached = resolverCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ttl) {
      logger.info('Cache hit', { cacheKey });
      return cached.data;
    }
    
    // Execute handler
    const result = await handler(event, context);
    
    // Update cache
    resolverCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });
    
    // Cleanup old entries
    if (resolverCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of resolverCache.entries()) {
        if (now - value.timestamp > ttl) {
          resolverCache.delete(key);
        }
      }
    }
    
    return result;
  }, options);
};

/**
 * Direct Lambda resolver (bypasses some AppSync overhead)
 */
export const createDirectHandler = <TArgs = any, TResult = any>(
  handler: (args: TArgs, context: GraphQLContext) => Promise<TResult>
) => {
  return createHandler<TArgs, TResult>(async (event, context) => {
    // Direct resolvers get arguments directly
    return handler(event.arguments as TArgs, context);
  });
};

// Export types and utilities
export type { GraphQLContext };
export { 
  ValidationError, 
  NotFoundError, 
  ConflictError, 
  UnauthorizedError 
};