import { AppSyncResolverEvent, AppSyncIdentity } from 'aws-lambda';
import { createHandler } from '../../../../shared/lambda-base/src';
import { logger, metrics } from 'powertools';
import { User } from 'entities';
import { UserRepository } from 'repositories';
import { 
  CreateUserInput, 
  UpdateUserInput,
  ClerkWebhookInput,
  User as GraphQLUser,
  WebhookResponse
} from 'graphql-types';
import { generateClkkTag } from 'common';

// Custom error class
class AppError extends Error {
  constructor(message: string, public code: string, public statusCode: number) {
    super(message);
    this.name = 'AppError';
  }
}

const resolveField = async (event: unknown): Promise<any> => {
  const appSyncEvent = event as AppSyncResolverEvent<any>;
  const { info, arguments: args, identity } = appSyncEvent;
  const field = info.fieldName;
  
  logger.info('Resolving field', { 
    field, 
    userId: identity && 'claims' in identity ? identity.claims?.sub : undefined 
  });
  
  const userRepository = new UserRepository();
  
  try {
    switch (field) {
      // Query resolvers
      case 'getUser':
        return await getUser(args.id, userRepository);
      case 'getUserByClerkId':
        return await getUserByClerkId(args.clerkId, userRepository);
      case 'getUserByEmail':
        return await getUserByEmail(args.email, userRepository);
      case 'getUserByClkkTag':
        return await getUserByClkkTag(args.clkkTag, userRepository);
      
      // Mutation resolvers
      case 'createUser':
        return await createUser(args.input, userRepository);
      case 'updateUser':
        return await updateUser(args.id, args.input, userRepository, appSyncEvent.identity);
      case 'processClerkWebhook':
        return await processClerkWebhook(args.input, userRepository);
      
      default:
        throw new AppError(`Unknown field: ${field}`, 'UNKNOWN_FIELD', 400);
    }
  } catch (error) {
    logger.error('Resolver error', error as Error, { field });
    metrics.addMetric(`ResolverError_${field}`, 'Count', 1);
    throw error;
  }
};

// Query Resolvers
async function getUser(id: string, userRepository: UserRepository): Promise<GraphQLUser | null> {
  const user = await userRepository.getById(id);
  if (!user) {
    return null;
  }
  
  metrics.addMetric('GetUser', 'Count', 1);
  return user.toGraphQLType();
}

async function getUserByClerkId(clerkId: string, userRepository: UserRepository): Promise<GraphQLUser | null> {
  const user = await userRepository.getByClerkId(clerkId);
  if (!user) {
    return null;
  }
  
  metrics.addMetric('GetUserByClerkId', 'Count', 1);
  return user.toGraphQLType();
}

async function getUserByEmail(email: string, userRepository: UserRepository): Promise<GraphQLUser | null> {
  const user = await userRepository.getByEmail(email);
  if (!user) {
    return null;
  }
  
  metrics.addMetric('GetUserByEmail', 'Count', 1);
  return user.toGraphQLType();
}

async function getUserByClkkTag(clkkTag: string, userRepository: UserRepository): Promise<GraphQLUser | null> {
  const user = await userRepository.getByClkkTag(clkkTag);
  if (!user) {
    return null;
  }
  
  metrics.addMetric('GetUserByClkkTag', 'Count', 1);
  return user.toGraphQLType();
}

// Mutation Resolvers
async function createUser(input: CreateUserInput, userRepository: UserRepository): Promise<GraphQLUser> {
  // Check if user already exists
  const existingUser = await userRepository.getByClerkId(input.clerkId);
  if (existingUser) {
    throw new AppError('User with this Clerk ID already exists', 'USER_EXISTS', 409);
  }

  // Check if email is already taken
  const emailUser = await userRepository.getByEmail(input.email);
  if (emailUser) {
    throw new AppError('User with this email already exists', 'EMAIL_EXISTS', 409);
  }

  // Create user from input
  const user = User.fromGraphQLInput(input);
  
  // Save to database
  await user.create();
  
  logger.info('User created via GraphQL', { userId: user.id, clerkId: user.clerkId });
  metrics.addMetric('CreateUser', 'Count', 1);
  
  return user.toGraphQLType();
}

async function updateUser(
  id: string, 
  input: UpdateUserInput, 
  userRepository: UserRepository,
  identity: AppSyncIdentity
): Promise<GraphQLUser> {
  // Get existing user
  const user = await userRepository.getById(id);
  if (!user) {
    throw new AppError('User not found', 'USER_NOT_FOUND', 404);
  }

  // Verify user can update their own profile
  const callerUserId = identity && 'claims' in identity ? identity.claims?.sub : undefined;
  if (callerUserId && callerUserId !== user.clerkId) {
    throw new AppError('Unauthorized to update this user', 'UNAUTHORIZED', 403);
  }

  // Apply updates
  user.applyUpdates(input);
  
  // Save changes
  await user.save();
  
  logger.info('User updated via GraphQL', { userId: user.id });
  metrics.addMetric('UpdateUser', 'Count', 1);
  
  return user.toGraphQLType();
}

async function processClerkWebhook(
  input: ClerkWebhookInput, 
  userRepository: UserRepository
): Promise<WebhookResponse> {
  logger.info('Processing Clerk webhook via GraphQL', { type: input.type });
  
  const webhookData = input.data as any;
  
  try {
    switch (input.type) {
      case 'user.created':
        await handleUserCreated(webhookData, userRepository);
        break;
      case 'user.updated':
        await handleUserUpdated(webhookData, userRepository);
        break;
      case 'user.deleted':
        await handleUserDeleted(webhookData, userRepository);
        break;
      default:
        logger.info('Unhandled webhook type', { type: input.type });
    }

    metrics.addMetric(`WebhookProcessed_${input.type}`, 'Count', 1);
    
    return {
      success: true,
      message: `Webhook ${input.type} processed successfully`,
    };
  } catch (error) {
    logger.error('Error processing webhook', error as Error);
    return {
      success: false,
      message: (error as Error).message,
    };
  }
}

// Webhook handlers (shared with webhook Lambda)
async function handleUserCreated(webhookData: any, userRepository: UserRepository): Promise<void> {
  const clerkId = webhookData.id;
  
  // Check if user already exists
  const existingUser = await userRepository.getByClerkId(clerkId);
  if (existingUser) {
    logger.info('User already exists', { clerkId });
    return;
  }

  // Extract primary email
  const primaryEmail = webhookData.email_addresses?.find(
    (email: any) => email.verification?.status === 'verified'
  )?.email_address;

  if (!primaryEmail) {
    throw new AppError('No verified email address found', 'VALIDATION_ERROR', 400);
  }

  // Create new user
  const user = new User({
    clerkId,
    email: primaryEmail,
    firstName: webhookData.first_name,
    lastName: webhookData.last_name,
    phoneNumber: webhookData.phone_numbers?.[0]?.phone_number,
  });

  // Generate CLKK tag if we have first and last name
  if (user.firstName && user.lastName) {
    user.clkkTag = generateClkkTag(user.firstName, user.lastName);
  }

  await user.create();
  logger.info('User created from webhook', { userId: user.id, clerkId });
}

async function handleUserUpdated(webhookData: any, userRepository: UserRepository): Promise<void> {
  const clerkId = webhookData.id;
  
  // Find existing user
  const user = await userRepository.getByClerkId(clerkId);
  if (!user) {
    logger.warn('User not found for update', { clerkId });
    // Create the user if it doesn't exist
    await handleUserCreated(webhookData, userRepository);
    return;
  }

  // Update user fields
  let hasChanges = false;

  // Update email if changed
  const primaryEmail = webhookData.email_addresses?.find(
    (email: any) => email.verification?.status === 'verified'
  )?.email_address;
  
  if (primaryEmail && primaryEmail !== user.email) {
    user.email = primaryEmail;
    hasChanges = true;
  }

  // Update other fields
  if (webhookData.first_name !== undefined && webhookData.first_name !== user.firstName) {
    user.firstName = webhookData.first_name;
    hasChanges = true;
  }

  if (webhookData.last_name !== undefined && webhookData.last_name !== user.lastName) {
    user.lastName = webhookData.last_name;
    hasChanges = true;
  }

  const primaryPhone = webhookData.phone_numbers?.[0]?.phone_number;
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
    logger.info('User updated from webhook', { userId: user.id, clerkId });
  }
}

async function handleUserDeleted(webhookData: any, userRepository: UserRepository): Promise<void> {
  const clerkId = webhookData.id;
  
  // Find existing user
  const user = await userRepository.getByClerkId(clerkId);
  if (!user) {
    logger.warn('User not found for deletion', { clerkId });
    return;
  }

  // Soft delete by updating metadata
  user.metadata = {
    ...user.metadata,
    deletedAt: new Date().toISOString(),
    deletedBy: 'clerk_webhook',
  };
  
  await user.save();
  logger.info('User marked as deleted', { userId: user.id, clerkId });
}

export const handler = createHandler(resolveField);