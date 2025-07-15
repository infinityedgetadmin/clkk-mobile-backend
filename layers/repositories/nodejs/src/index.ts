/**
 * Repositories Layer - Data access layer
 * Separates database operations from business logic
 */

export { BaseRepository } from './base-repository';
export { UserRepository } from './user.repository';
export { UserRepository as UserRepo } from './user-repository';

// Future repositories to be added:
// export { TransactionRepository } from './transaction.repository';
// export { WalletRepository } from './wallet.repository';