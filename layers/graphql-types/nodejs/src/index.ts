/**
 * Generated GraphQL TypeScript types
 * This is a placeholder file - run `npm run codegen` to generate actual types
 */

// Scalar types
export type AWSDateTime = string;
export type AWSEmail = string;
export type AWSPhone = string;
export type AWSJSON = any;

// Enums
export type KycStatus = 
  | 'NOT_STARTED'
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED';

export type DocumentType =
  | 'DRIVERS_LICENSE'
  | 'PASSPORT'
  | 'ID_CARD'
  | 'PROOF_OF_ADDRESS';

export type DocumentStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED';

export type WalletStatus =
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'CLOSED';

export type WalletType =
  | 'FIAT'
  | 'CRYPTO';

export type Currency =
  | 'USD'
  | 'EUR'
  | 'GBP';

export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRANSFER'
  | 'FEE'
  | 'REFUND';

export type TransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

// Types
export interface User {
  id: string;
  clerkId: string;
  email: AWSEmail;
  phoneNumber?: AWSPhone | null;
  firstName?: string | null;
  lastName?: string | null;
  clkkTag?: string | null;
  kycStatus: KycStatus;
  kycDetails?: KYCDetails | null;
  profileImageUrl?: string | null;
  dateOfBirth?: string | null;
  address?: Address | null;
  metadata?: AWSJSON | null;
  createdAt: AWSDateTime;
  updatedAt: AWSDateTime;
}

export interface KYCDetails {
  provider?: string | null;
  verificationId?: string | null;
  status: KycStatus;
  verifiedAt?: AWSDateTime | null;
  documents?: KYCDocument[] | null;
}

export interface KYCDocument {
  type: DocumentType;
  status: DocumentStatus;
  uploadedAt: AWSDateTime;
  verifiedAt?: AWSDateTime | null;
  url?: string | null;
}

export interface Address {
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Wallet {
  id: string;
  userId: string;
  balance: Money;
  status: WalletStatus;
  type: WalletType;
  createdAt: AWSDateTime;
  updatedAt: AWSDateTime;
}

export interface Money {
  amount: number;
  currency: Currency;
}

export interface Transaction {
  id: string;
  userId: string;
  walletId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: Money;
  description?: string | null;
  metadata?: AWSJSON | null;
  createdAt: AWSDateTime;
  updatedAt: AWSDateTime;
}

// Input types
export interface CreateUserInput {
  clerkId: string;
  email: AWSEmail;
  phoneNumber?: AWSPhone | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface UpdateUserInput {
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: AWSPhone | null;
  profileImageUrl?: string | null;
  dateOfBirth?: string | null;
  address?: AddressInput | null;
}

export interface AddressInput {
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface KYCDocumentInput {
  type: DocumentType;
  fileKey: string;
}

export interface ClerkWebhookInput {
  type: string;
  data: AWSJSON;
}

export interface WebhookResponse {
  success: boolean;
  message?: string | null;
}

export interface TransactionConnection {
  items: Transaction[];
  nextToken?: string | null;
  totalCount?: number | null;
}