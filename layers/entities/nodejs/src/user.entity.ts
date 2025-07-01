import { BaseEntity } from './base-entity';
import {
  ATTRIBUTES,
  KEY_BUILDERS,
  KYC_STATUS,
  KycStatus as KycStatusType,
} from '@clkk/constants-layer';
import { 
  User as GraphQLUser,
  KycStatus as GraphQLKycStatus,
  CreateUserInput,
  UpdateUserInput,
  Address,
} from '@clkk/graphql-types';
import { generateUserId, generateClkkTag, commonSchemas } from '@clkk/common-layer';
import { z } from 'zod';
import { logger } from '@clkk/powertools-layer';

/**
 * User Entity with GraphQL integration
 * Extends BaseEntity for common database operations
 */
export class User extends BaseEntity {
  // User properties matching GraphQL schema
  clerkId!: string;
  email!: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  clkkTag?: string;
  kycStatus: KycStatusType = KYC_STATUS.NOT_STARTED;
  kycDetails?: {
    provider?: string;
    verificationId?: string;
    status: KycStatusType;
    verifiedAt?: string;
    documents?: Array<{
      type: string;
      status: string;
      uploadedAt: string;
      verifiedAt?: string;
      url?: string;
    }>;
  };
  profileImageUrl?: string;
  dateOfBirth?: string;
  address?: Address;
  metadata?: Record<string, any>;

  constructor(data?: Partial<User>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
    
    // Generate ID if not provided
    if (!this.id) {
      this.id = generateUserId();
    }
    
    // Set default KYC status
    if (!this.kycStatus) {
      this.kycStatus = KYC_STATUS.NOT_STARTED;
    }
  }

  /**
   * Get primary key for DynamoDB
   */
  getPrimaryKey(): Record<string, string> {
    return KEY_BUILDERS.user(this.id);
  }

  /**
   * Convert to DynamoDB item
   */
  toItem(): Record<string, any> {
    const item: Record<string, any> = {
      [ATTRIBUTES.ID]: this.id,
      [ATTRIBUTES.CLERK_ID]: this.clerkId,
      [ATTRIBUTES.EMAIL]: this.email,
      [ATTRIBUTES.KYC_STATUS]: this.kycStatus,
    };

    // Add optional fields
    if (this.phoneNumber) item[ATTRIBUTES.PHONE_NUMBER] = this.phoneNumber;
    if (this.firstName) item[ATTRIBUTES.FIRST_NAME] = this.firstName;
    if (this.lastName) item[ATTRIBUTES.LAST_NAME] = this.lastName;
    if (this.clkkTag) item[ATTRIBUTES.CLKK_TAG] = this.clkkTag;
    if (this.kycDetails) item[ATTRIBUTES.KYC_DETAILS] = this.kycDetails;
    if (this.profileImageUrl) item[ATTRIBUTES.PROFILE_IMAGE_URL] = this.profileImageUrl;
    if (this.dateOfBirth) item[ATTRIBUTES.DATE_OF_BIRTH] = this.dateOfBirth;
    if (this.address) item[ATTRIBUTES.ADDRESS] = this.address;
    if (this.metadata) item[ATTRIBUTES.METADATA] = this.metadata;

    // Add GSI keys
    item[ATTRIBUTES.EXTERNAL_ID_KEY] = KEY_BUILDERS.userByClerkId(this.clerkId)[ATTRIBUTES.EXTERNAL_ID_KEY];
    item[ATTRIBUTES.EMAIL_KEY] = KEY_BUILDERS.userByEmail(this.email)[ATTRIBUTES.EMAIL_KEY];
    
    if (this.clkkTag) {
      item[ATTRIBUTES.CLKK_TAG_KEY] = KEY_BUILDERS.userByClkkTag(this.clkkTag)[ATTRIBUTES.CLKK_TAG_KEY];
    }

    return item;
  }

  /**
   * Convert from DynamoDB item
   */
  protected fromItem(item: Record<string, any>): Partial<User> {
    return {
      id: item[ATTRIBUTES.ID],
      clerkId: item[ATTRIBUTES.CLERK_ID],
      email: item[ATTRIBUTES.EMAIL],
      phoneNumber: item[ATTRIBUTES.PHONE_NUMBER],
      firstName: item[ATTRIBUTES.FIRST_NAME],
      lastName: item[ATTRIBUTES.LAST_NAME],
      clkkTag: item[ATTRIBUTES.CLKK_TAG],
      kycStatus: item[ATTRIBUTES.KYC_STATUS],
      kycDetails: item[ATTRIBUTES.KYC_DETAILS],
      profileImageUrl: item[ATTRIBUTES.PROFILE_IMAGE_URL],
      dateOfBirth: item[ATTRIBUTES.DATE_OF_BIRTH],
      address: item[ATTRIBUTES.ADDRESS],
      metadata: item[ATTRIBUTES.METADATA],
      createdAt: item[ATTRIBUTES.CREATED_AT],
      updatedAt: item[ATTRIBUTES.UPDATED_AT],
    };
  }

  /**
   * Validate user data
   */
  validate(): void {
    const schema = z.object({
      id: z.string().min(1),
      clerkId: z.string().min(1),
      email: commonSchemas.email,
      phoneNumber: commonSchemas.phoneNumber.optional(),
      firstName: z.string().min(1).max(50).optional(),
      lastName: z.string().min(1).max(50).optional(),
      clkkTag: z.string().min(3).max(20).optional(),
      kycStatus: z.enum(Object.values(KYC_STATUS) as [string, ...string[]]),
    });

    try {
      schema.parse({
        id: this.id,
        clerkId: this.clerkId,
        email: this.email,
        phoneNumber: this.phoneNumber,
        firstName: this.firstName,
        lastName: this.lastName,
        clkkTag: this.clkkTag,
        kycStatus: this.kycStatus,
      });
    } catch (error) {
      logger.error('User validation failed', error as Error);
      throw new Error(`User validation failed: ${(error as z.ZodError).message}`);
    }
  }

  /**
   * Convert to GraphQL type
   */
  toGraphQLType(): GraphQLUser {
    return {
      id: this.id,
      clerkId: this.clerkId,
      email: this.email,
      phoneNumber: this.phoneNumber || null,
      firstName: this.firstName || null,
      lastName: this.lastName || null,
      clkkTag: this.clkkTag || null,
      kycStatus: this.kycStatus as GraphQLKycStatus,
      kycDetails: this.kycDetails ? {
        ...this.kycDetails,
        status: this.kycDetails.status as GraphQLKycStatus,
      } : null,
      profileImageUrl: this.profileImageUrl || null,
      dateOfBirth: this.dateOfBirth || null,
      address: this.address || null,
      metadata: this.metadata || null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Create user from GraphQL input
   */
  static fromGraphQLInput(input: CreateUserInput): User {
    const user = new User({
      clerkId: input.clerkId,
      email: input.email,
      phoneNumber: input.phoneNumber || undefined,
      firstName: input.firstName || undefined,
      lastName: input.lastName || undefined,
    });

    // Generate CLKK tag if we have first and last name
    if (user.firstName && user.lastName) {
      user.clkkTag = generateClkkTag(user.firstName, user.lastName);
    }

    return user;
  }

  /**
   * Apply updates from GraphQL input
   */
  applyUpdates(input: UpdateUserInput): void {
    if (input.firstName !== undefined) this.firstName = input.firstName || undefined;
    if (input.lastName !== undefined) this.lastName = input.lastName || undefined;
    if (input.phoneNumber !== undefined) this.phoneNumber = input.phoneNumber || undefined;
    if (input.profileImageUrl !== undefined) this.profileImageUrl = input.profileImageUrl || undefined;
    if (input.dateOfBirth !== undefined) this.dateOfBirth = input.dateOfBirth || undefined;
    if (input.address !== undefined) this.address = input.address || undefined;

    // Regenerate CLKK tag if name changed and tag doesn't exist
    if (!this.clkkTag && this.firstName && this.lastName) {
      this.clkkTag = generateClkkTag(this.firstName, this.lastName);
    }
  }

  /**
   * Static method to get user by ID
   */
  static async getById(userId: string): Promise<User | null> {
    const key = KEY_BUILDERS.user(userId);
    return this.getByKey<User>(key);
  }

  /**
   * Static method to get user by Clerk ID
   */
  static async getByClerkId(clerkId: string): Promise<User | null> {
    // This would use a GSI query - implemented in UserRepository
    logger.warn('getByClerkId should be called through UserRepository');
    return null;
  }

  /**
   * Static method to get user by email
   */
  static async getByEmail(email: string): Promise<User | null> {
    // This would use a GSI query - implemented in UserRepository
    logger.warn('getByEmail should be called through UserRepository');
    return null;
  }

  /**
   * Update KYC status
   */
  async updateKycStatus(status: KycStatusType, details?: Partial<User['kycDetails']>): Promise<void> {
    this.kycStatus = status;
    
    if (details) {
      this.kycDetails = {
        ...this.kycDetails,
        ...details,
        status,
      };
    }

    await this.update({
      [ATTRIBUTES.KYC_STATUS]: this.kycStatus,
      [ATTRIBUTES.KYC_DETAILS]: this.kycDetails,
    });
  }

  /**
   * Check if user is KYC verified
   */
  isKycVerified(): boolean {
    return this.kycStatus === KYC_STATUS.APPROVED;
  }

  /**
   * Check if user profile is complete
   */
  isProfileComplete(): boolean {
    return !!(
      this.firstName &&
      this.lastName &&
      this.phoneNumber &&
      this.dateOfBirth &&
      this.address
    );
  }
}