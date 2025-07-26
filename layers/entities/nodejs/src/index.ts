/**
 * Entities Layer - Domain models with business logic
 * All entities extend BaseEntity for consistent database operations
 */

export { BaseEntity } from './base-entity';
export { User } from './user.entity';
export { User as UserEntity, UserData } from './user';

// Future entities to be added:
// export { Transaction } from './transaction.entity';
// export { Wallet } from './wallet.entity';
// export { KycDocument } from './kyc-document.entity';