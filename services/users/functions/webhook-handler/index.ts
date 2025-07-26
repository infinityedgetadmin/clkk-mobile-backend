import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import middy from '@middy/core';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import { logger, metrics, tracer } from 'powertools';
import { User } from 'entities';
import { UserRepository } from 'repositories';
import { generateUserId, generateClkkTag } from 'common';

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{
      email_address: string;
      verification: {
        status: string;
      };
    }>;
    first_name?: string;
    last_name?: string;
    phone_numbers?: Array<{
      phone_number: string;
    }>;
    created_at?: number;
    updated_at?: number;
  };
  object: string;
}

interface WebhookResponse {
  success: boolean;
  message: string;
  userId?: string;
}

const processWebhook = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (!event.body) {
    logger.error('Missing request body');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing request body' }),
    };
  }

  const webhook: ClerkWebhookEvent = JSON.parse(event.body);
  logger.info('Processing Clerk webhook', { type: webhook.type, userId: webhook.data.id });

  const userRepository = new UserRepository();
  let response: WebhookResponse;

  try {
    switch (webhook.type) {
      case 'user.created':
        response = await handleUserCreated(webhook, userRepository);
        break;
      case 'user.updated':
        response = await handleUserUpdated(webhook, userRepository);
        break;
      case 'user.deleted':
        response = await handleUserDeleted(webhook, userRepository);
        break;
      default:
        logger.info('Unhandled webhook type', { type: webhook.type });
        response = {
          success: true,
          message: `Webhook type ${webhook.type} acknowledged but not processed`,
        };
    }

    metrics.addMetric(`WebhookProcessed_${webhook.type}`, 'Count', 1);
    
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    logger.error('Error processing webhook', error as Error);
    metrics.addMetric('WebhookProcessingError', 'Count', 1);
    throw error;
  }
};

async function handleUserCreated(
  webhook: ClerkWebhookEvent,
  userRepository: UserRepository
): Promise<WebhookResponse> {
  const clerkUser = webhook.data;
  
  // Check if user already exists
  const existingUser = await userRepository.getByClerkId(clerkUser.id);
  if (existingUser) {
    logger.info('User already exists', { clerkId: clerkUser.id });
    return {
      success: true,
      message: 'User already exists',
      userId: existingUser.id,
    };
  }

  // Extract primary email
  const primaryEmail = clerkUser.email_addresses?.find(
    email => email.verification.status === 'verified'
  )?.email_address;

  if (!primaryEmail) {
    logger.error('No verified email address found', { clerkId: clerkUser.id });
    throw new Error('No verified email address found');
  }

  // Extract primary phone number
  const primaryPhone = clerkUser.phone_numbers?.[0]?.phone_number;

  // Create new user
  const user = new User({
    id: generateUserId(),
    clerkId: clerkUser.id,
    email: primaryEmail,
    firstName: clerkUser.first_name,
    lastName: clerkUser.last_name,
    phoneNumber: primaryPhone,
  });

  // Generate CLKK tag if we have first and last name
  if (user.firstName && user.lastName) {
    user.clkkTag = generateClkkTag(user.firstName, user.lastName);
  }

  // Save user to database
  await user.create();
  
  logger.info('User created successfully', { userId: user.id, clerkId: user.clerkId });
  metrics.addMetric('UserCreated', 'Count', 1);

  return {
    success: true,
    message: 'User created successfully',
    userId: user.id,
  };
}

async function handleUserUpdated(
  webhook: ClerkWebhookEvent,
  userRepository: UserRepository
): Promise<WebhookResponse> {
  const clerkUser = webhook.data;
  
  // Find existing user
  const user = await userRepository.getByClerkId(clerkUser.id);
  if (!user) {
    logger.warn('User not found for update', { clerkId: clerkUser.id });
    // Create the user if it doesn't exist (handles out-of-order webhooks)
    return handleUserCreated(webhook, userRepository);
  }

  // Update user fields
  let hasChanges = false;

  // Update email if changed
  const primaryEmail = clerkUser.email_addresses?.find(
    email => email.verification.status === 'verified'
  )?.email_address;
  
  if (primaryEmail && primaryEmail !== user.email) {
    user.email = primaryEmail;
    hasChanges = true;
  }

  // Update name fields
  if (clerkUser.first_name !== undefined && clerkUser.first_name !== user.firstName) {
    user.firstName = clerkUser.first_name;
    hasChanges = true;
  }

  if (clerkUser.last_name !== undefined && clerkUser.last_name !== user.lastName) {
    user.lastName = clerkUser.last_name;
    hasChanges = true;
  }

  // Update phone number
  const primaryPhone = clerkUser.phone_numbers?.[0]?.phone_number;
  if (primaryPhone && primaryPhone !== user.phoneNumber) {
    user.phoneNumber = primaryPhone;
    hasChanges = true;
  }

  // Generate or update CLKK tag if needed
  if (!user.clkkTag && user.firstName && user.lastName) {
    user.clkkTag = generateClkkTag(user.firstName, user.lastName);
    hasChanges = true;
  }

  if (hasChanges) {
    await user.save();
    logger.info('User updated successfully', { userId: user.id, clerkId: user.clerkId });
    metrics.addMetric('UserUpdated', 'Count', 1);
  } else {
    logger.info('No changes detected for user', { userId: user.id, clerkId: user.clerkId });
  }

  return {
    success: true,
    message: hasChanges ? 'User updated successfully' : 'No changes detected',
    userId: user.id,
  };
}

async function handleUserDeleted(
  webhook: ClerkWebhookEvent,
  userRepository: UserRepository
): Promise<WebhookResponse> {
  const clerkId = webhook.data.id;
  
  // Find existing user
  const user = await userRepository.getByClerkId(clerkId);
  if (!user) {
    logger.warn('User not found for deletion', { clerkId });
    return {
      success: true,
      message: 'User not found',
    };
  }

  // Soft delete by updating status
  user.metadata = {
    ...user.metadata,
    deletedAt: new Date().toISOString(),
    deletedBy: 'clerk_webhook',
  };
  
  await user.save();
  
  logger.info('User marked as deleted', { userId: user.id, clerkId: user.clerkId });
  metrics.addMetric('UserDeleted', 'Count', 1);

  return {
    success: true,
    message: 'User marked as deleted',
    userId: user.id,
  };
}

// Create the handler with middleware
export const handler = middy(processWebhook)
  .use(injectLambdaContext(logger))
  .use(captureLambdaHandler(tracer))
  .use(logMetrics(metrics));