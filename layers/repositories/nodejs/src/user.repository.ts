import { BaseRepository } from './base-repository';
import { User } from '@clkk/entities-layer';
import {
  ATTRIBUTES,
  INDEXES,
  KEY_BUILDERS,
  QUERY_BUILDERS,
} from '@clkk/constants-layer';
import { logger } from '@clkk/powertools-layer';
import { PaginationParams } from '@clkk/common-layer';

/**
 * User Repository - Data access layer for User entity
 * Implements all database queries for users
 */
export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(User);
  }

  /**
   * Get user by ID
   */
  async getById(userId: string): Promise<User | null> {
    try {
      const key = KEY_BUILDERS.user(userId);
      return await User.getById(userId);
    } catch (error) {
      logger.error('Failed to get user by ID', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get user by Clerk ID using GSI
   */
  async getByClerkId(clerkId: string): Promise<User | null> {
    try {
      const keyCondition = QUERY_BUILDERS.keyCondition(
        ATTRIBUTES.EXTERNAL_ID_KEY,
        KEY_BUILDERS.userByClerkId(clerkId)[ATTRIBUTES.EXTERNAL_ID_KEY]
      );
      
      const result = await this.queryByIndex(INDEXES.EXTERNAL_ID, keyCondition, {
        pagination: { limit: 1 },
      });
      
      return result.items.length > 0 ? result.items[0] : null;
    } catch (error) {
      logger.error('Failed to get user by Clerk ID', error as Error, { clerkId });
      throw error;
    }
  }

  /**
   * Get user by email using GSI
   */
  async getByEmail(email: string): Promise<User | null> {
    try {
      const keyCondition = QUERY_BUILDERS.keyCondition(
        ATTRIBUTES.EMAIL_KEY,
        KEY_BUILDERS.userByEmail(email)[ATTRIBUTES.EMAIL_KEY]
      );
      
      const result = await this.queryByIndex(INDEXES.EMAIL, keyCondition, {
        pagination: { limit: 1 },
      });
      
      return result.items.length > 0 ? result.items[0] : null;
    } catch (error) {
      logger.error('Failed to get user by email', error as Error, { email });
      throw error;
    }
  }

  /**
   * Get user by CLKK tag using GSI
   */
  async getByClkkTag(clkkTag: string): Promise<User | null> {
    try {
      const keyCondition = QUERY_BUILDERS.keyCondition(
        ATTRIBUTES.CLKK_TAG_KEY,
        KEY_BUILDERS.userByClkkTag(clkkTag)[ATTRIBUTES.CLKK_TAG_KEY]
      );
      
      const result = await this.queryByIndex(INDEXES.CLKK_TAG, keyCondition, {
        pagination: { limit: 1 },
      });
      
      return result.items.length > 0 ? result.items[0] : null;
    } catch (error) {
      logger.error('Failed to get user by CLKK tag', error as Error, { clkkTag });
      throw error;
    }
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const user = await this.getByEmail(email);
    return user !== null;
  }

  /**
   * Check if CLKK tag exists
   */
  async clkkTagExists(clkkTag: string): Promise<boolean> {
    const user = await this.getByClkkTag(clkkTag);
    return user !== null;
  }

  /**
   * Get multiple users by IDs
   */
  async getByIds(userIds: string[]): Promise<User[]> {
    if (userIds.length === 0) return [];
    
    try {
      const keys = userIds.map(id => KEY_BUILDERS.user(id));
      return await this.batchGet(keys);
    } catch (error) {
      logger.error('Failed to get users by IDs', error as Error, { 
        userCount: userIds.length 
      });
      throw error;
    }
  }

  /**
   * Create multiple users (batch operation)
   */
  async createMany(users: User[]): Promise<void> {
    if (users.length === 0) return;
    
    try {
      // Validate all users first
      for (const user of users) {
        user.validate();
      }
      
      await this.batchWrite(users);
      
      logger.info('Created multiple users', { count: users.length });
    } catch (error) {
      logger.error('Failed to create multiple users', error as Error, {
        userCount: users.length,
      });
      throw error;
    }
  }

  /**
   * Search users by partial email (scan operation - use sparingly)
   */
  async searchByEmailPrefix(
    emailPrefix: string,
    options?: PaginationParams
  ): Promise<{
    users: User[];
    nextToken?: string;
  }> {
    // This would typically use a scan with filter
    // For production, consider using OpenSearch or another search service
    logger.warn('searchByEmailPrefix uses scan - consider using a search service');
    
    // Placeholder implementation
    return {
      users: [],
      nextToken: undefined,
    };
  }

  /**
   * Get users by KYC status
   */
  async getByKycStatus(
    status: string,
    options?: PaginationParams
  ): Promise<{
    users: User[];
    nextToken?: string;
  }> {
    try {
      const keyCondition = QUERY_BUILDERS.keyCondition(
        ATTRIBUTES.TYPE_STATUS_KEY,
        `USER#KYC#${status}`
      );
      
      const result = await this.queryByIndex(INDEXES.TYPE_STATUS, keyCondition, {
        pagination: options,
        scanIndexForward: false, // Most recent first
      });
      
      return {
        users: result.items,
        nextToken: result.nextToken,
      };
    } catch (error) {
      logger.error('Failed to get users by KYC status', error as Error, { status });
      throw error;
    }
  }

  /**
   * Get recently created users
   */
  async getRecentUsers(
    limit: number = 10,
    nextToken?: string
  ): Promise<{
    users: User[];
    nextToken?: string;
  }> {
    try {
      // This would use a time-based GSI
      // For now, returning empty as placeholder
      logger.info('Getting recent users', { limit });
      
      return {
        users: [],
        nextToken: undefined,
      };
    } catch (error) {
      logger.error('Failed to get recent users', error as Error);
      throw error;
    }
  }

  /**
   * Count total users (expensive operation - cache result)
   */
  async countTotalUsers(): Promise<number> {
    // This would typically be maintained as a counter
    // or retrieved from a metrics service
    logger.warn('countTotalUsers is an expensive operation');
    return 0;
  }

  /**
   * Generate unique CLKK tag
   */
  async generateUniqueClkkTag(firstName: string, lastName: string): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const tag = this.generateClkkTag(firstName, lastName);
      const exists = await this.clkkTagExists(tag);
      
      if (!exists) {
        return tag;
      }
      
      attempts++;
    }
    
    throw new Error('Failed to generate unique CLKK tag after maximum attempts');
  }

  /**
   * Helper to generate CLKK tag
   */
  private generateClkkTag(firstName: string, lastName: string): string {
    const cleanFirst = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLast = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    
    return `${cleanFirst}${cleanLast}${random}`;
  }
}