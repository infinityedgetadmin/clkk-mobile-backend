import { AppSyncAuthorizerHandler, AppSyncAuthorizerResult } from 'aws-lambda';
import { logger, tracer, metrics, addCorrelationId, logMetric, docClient } from '@clkk/powertools-layer';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { createHmac } from 'crypto';
import { ATTRIBUTES, KEY_BUILDERS } from '@clkk/constants-layer';

// Initialize clients
const secretsClient = tracer.captureAWSv3Client(new SecretsManagerClient({}));

const TABLE_NAME = process.env.TABLE_NAME!;
const ENVIRONMENT = process.env.ENVIRONMENT!;

interface ClerkWebhookPayload {
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string }>;
    first_name?: string;
    last_name?: string;
    phone_numbers?: Array<{ phone_number: string }>;
  };
  type: string;
}

interface AuthContext {
  userId?: string;
  clerkId?: string;
  email?: string;
  role?: string;
  isWebhook?: boolean;
}

// Cache for webhook secret
let webhookSecret: string | null = null;

const getWebhookSecret = async (): Promise<string> => {
  if (webhookSecret) return webhookSecret;

  const command = new GetSecretValueCommand({
    SecretId: `clkk-backend/${ENVIRONMENT}/clerk-webhook-secret`,
  });

  const response = await secretsClient.send(command);
  const secret = JSON.parse(response.SecretString || '{}');
  webhookSecret = secret.secret;
  
  return webhookSecret;
};

const verifyClerkWebhook = async (payload: string, signature: string): Promise<boolean> => {
  const secret = await getWebhookSecret();
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return signature === `sha256=${expectedSignature}`;
};

export const handler: AppSyncAuthorizerHandler = async (event, context) => {
  // Add correlation ID
  const requestId = context.requestId;
  addCorrelationId(requestId);
  
  logger.info('Authorizer invoked', {
    authorizationToken: event.authorizationToken ? 'present' : 'missing',
    requestContext: event.requestContext,
  });

  try {
    const authToken = event.authorizationToken;
    
    if (!authToken) {
      logger.warn('No authorization token provided');
      logMetric('AuthorizerRejected', 1);
      return {
        isAuthorized: false,
      };
    }

    // Check if this is a webhook request
    if (authToken.startsWith('webhook:')) {
      const [, signature, payload] = authToken.split(':');
      
      if (!signature || !payload) {
        logger.warn('Invalid webhook token format');
        logMetric('WebhookAuthFailed', 1);
        return {
          isAuthorized: false,
        };
      }

      const decodedPayload = Buffer.from(payload, 'base64').toString();
      const isValid = await verifyClerkWebhook(decodedPayload, signature);
      
      if (!isValid) {
        logger.warn('Invalid webhook signature');
        logMetric('WebhookSignatureInvalid', 1);
        return {
          isAuthorized: false,
        };
      }

      const webhookData = JSON.parse(decodedPayload) as ClerkWebhookPayload;
      
      logger.info('Webhook authorized', { type: webhookData.type });
      logMetric('WebhookAuthorized', 1);
      
      return {
        isAuthorized: true,
        resolverContext: {
          isWebhook: true,
          webhookType: webhookData.type,
          webhookData: webhookData.data,
        },
      };
    }

    // Check if this is a Clerk user token
    if (authToken.startsWith('clerk:')) {
      const clerkId = authToken.replace('clerk:', '');
      
      // Look up user in DynamoDB
      const response = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: KEY_BUILDERS.user(clerkId),
      }));

      if (!response.Item) {
        logger.warn('User not found', { clerkId });
        logMetric('UserNotFound', 1);
        return {
          isAuthorized: false,
        };
      }

      const user = response.Item;
      logger.info('User authorized', { 
        userId: user[ATTRIBUTES.ID], 
        email: user[ATTRIBUTES.EMAIL] 
      });
      logMetric('UserAuthorized', 1);

      return {
        isAuthorized: true,
        resolverContext: {
          userId: user[ATTRIBUTES.ID],
          clerkId: user[ATTRIBUTES.CLERK_ID],
          email: user[ATTRIBUTES.EMAIL],
          role: user.role || 'user',
        } as AuthContext,
      };
    }

    // Unknown token format
    logger.warn('Unknown authorization token format');
    logMetric('UnknownTokenFormat', 1);
    
    return {
      isAuthorized: false,
    };

  } catch (error) {
    logger.error('Authorizer error', error as Error);
    logMetric('AuthorizerError', 1);
    
    // Return unauthorized on error (fail closed)
    return {
      isAuthorized: false,
    };
  }
};