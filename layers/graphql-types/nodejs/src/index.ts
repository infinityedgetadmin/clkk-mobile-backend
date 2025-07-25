export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  AWSDateTime: { input: string; output: string; }
  AWSEmail: { input: string; output: string; }
  AWSJSON: { input: any; output: any; }
  AWSPhone: { input: string; output: string; }
};

export type Address = {
  __typename?: 'Address';
  city: Scalars['String']['output'];
  country: Scalars['String']['output'];
  postalCode: Scalars['String']['output'];
  state: Scalars['String']['output'];
  street1: Scalars['String']['output'];
  street2?: Maybe<Scalars['String']['output']>;
};

export type AddressInput = {
  city: Scalars['String']['input'];
  country: Scalars['String']['input'];
  postalCode: Scalars['String']['input'];
  state: Scalars['String']['input'];
  street1: Scalars['String']['input'];
  street2?: InputMaybe<Scalars['String']['input']>;
};

export type ClerkWebhookInput = {
  data: Scalars['AWSJSON']['input'];
  type: Scalars['String']['input'];
};

export type CreateUserInput = {
  clerkId: Scalars['String']['input'];
  email: Scalars['AWSEmail']['input'];
  firstName?: InputMaybe<Scalars['String']['input']>;
  lastName?: InputMaybe<Scalars['String']['input']>;
  phoneNumber?: InputMaybe<Scalars['AWSPhone']['input']>;
};

export type Currency =
  | 'EUR'
  | 'GBP'
  | 'USD';

export type DocumentStatus =
  | 'PENDING'
  | 'REJECTED'
  | 'VERIFIED';

export type DocumentType =
  | 'DRIVERS_LICENSE'
  | 'ID_CARD'
  | 'PASSPORT'
  | 'PROOF_OF_ADDRESS';

export type KycDetails = {
  __typename?: 'KYCDetails';
  documents?: Maybe<Array<KycDocument>>;
  provider?: Maybe<Scalars['String']['output']>;
  status: KycStatus;
  verificationId?: Maybe<Scalars['String']['output']>;
  verifiedAt?: Maybe<Scalars['AWSDateTime']['output']>;
};

export type KycDocument = {
  __typename?: 'KYCDocument';
  status: DocumentStatus;
  type: DocumentType;
  uploadedAt: Scalars['AWSDateTime']['output'];
  url?: Maybe<Scalars['String']['output']>;
  verifiedAt?: Maybe<Scalars['AWSDateTime']['output']>;
};

export type KycDocumentInput = {
  fileKey: Scalars['String']['input'];
  type: DocumentType;
};

export type KycStatus =
  | 'APPROVED'
  | 'EXPIRED'
  | 'IN_REVIEW'
  | 'NOT_STARTED'
  | 'PENDING'
  | 'REJECTED';

export type Money = {
  __typename?: 'Money';
  amount: Scalars['Int']['output'];
  currency: Currency;
};

export type Mutation = {
  __typename?: 'Mutation';
  createUser: User;
  initiateKYC: KycDetails;
  processClerkWebhook: WebhookResponse;
  updateUser: User;
  uploadKYCDocument: KycDocument;
};


export type MutationCreateUserArgs = {
  input: CreateUserInput;
};


export type MutationInitiateKycArgs = {
  userId: Scalars['ID']['input'];
};


export type MutationProcessClerkWebhookArgs = {
  input: ClerkWebhookInput;
};


export type MutationUpdateUserArgs = {
  id: Scalars['ID']['input'];
  input: UpdateUserInput;
};


export type MutationUploadKycDocumentArgs = {
  document: KycDocumentInput;
  userId: Scalars['ID']['input'];
};

export type Query = {
  __typename?: 'Query';
  getTransaction?: Maybe<Transaction>;
  getUser?: Maybe<User>;
  getUserByClerkId?: Maybe<User>;
  getUserByClkkTag?: Maybe<User>;
  getUserByEmail?: Maybe<User>;
  getUserTransactions: TransactionConnection;
  getUserWallets: Array<Wallet>;
  getWallet?: Maybe<Wallet>;
  health: Scalars['String']['output'];
};


export type QueryGetTransactionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetUserArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetUserByClerkIdArgs = {
  clerkId: Scalars['String']['input'];
};


export type QueryGetUserByClkkTagArgs = {
  clkkTag: Scalars['String']['input'];
};


export type QueryGetUserByEmailArgs = {
  email: Scalars['AWSEmail']['input'];
};


export type QueryGetUserTransactionsArgs = {
  endDate?: InputMaybe<Scalars['AWSDateTime']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['AWSDateTime']['input']>;
  userId: Scalars['ID']['input'];
};


export type QueryGetUserWalletsArgs = {
  userId: Scalars['ID']['input'];
};


export type QueryGetWalletArgs = {
  id: Scalars['ID']['input'];
};

export type Transaction = {
  __typename?: 'Transaction';
  amount: Money;
  createdAt: Scalars['AWSDateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  metadata?: Maybe<Scalars['AWSJSON']['output']>;
  status: TransactionStatus;
  type: TransactionType;
  updatedAt: Scalars['AWSDateTime']['output'];
  userId: Scalars['ID']['output'];
  walletId: Scalars['ID']['output'];
};

export type TransactionConnection = {
  __typename?: 'TransactionConnection';
  items: Array<Transaction>;
  nextToken?: Maybe<Scalars['String']['output']>;
  totalCount?: Maybe<Scalars['Int']['output']>;
};

export type TransactionStatus =
  | 'CANCELLED'
  | 'COMPLETED'
  | 'FAILED'
  | 'PENDING'
  | 'PROCESSING';

export type TransactionType =
  | 'DEPOSIT'
  | 'FEE'
  | 'REFUND'
  | 'TRANSFER'
  | 'WITHDRAWAL';

export type UpdateUserInput = {
  address?: InputMaybe<AddressInput>;
  dateOfBirth?: InputMaybe<Scalars['String']['input']>;
  firstName?: InputMaybe<Scalars['String']['input']>;
  lastName?: InputMaybe<Scalars['String']['input']>;
  phoneNumber?: InputMaybe<Scalars['AWSPhone']['input']>;
  profileImageUrl?: InputMaybe<Scalars['String']['input']>;
};

export type User = {
  __typename?: 'User';
  address?: Maybe<Address>;
  clerkId: Scalars['String']['output'];
  clkkTag?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['AWSDateTime']['output'];
  dateOfBirth?: Maybe<Scalars['String']['output']>;
  email: Scalars['AWSEmail']['output'];
  firstName?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  kycDetails?: Maybe<KycDetails>;
  kycStatus: KycStatus;
  lastName?: Maybe<Scalars['String']['output']>;
  metadata?: Maybe<Scalars['AWSJSON']['output']>;
  phoneNumber?: Maybe<Scalars['AWSPhone']['output']>;
  profileImageUrl?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['AWSDateTime']['output'];
};

export type Wallet = {
  __typename?: 'Wallet';
  balance: Money;
  createdAt: Scalars['AWSDateTime']['output'];
  id: Scalars['ID']['output'];
  status: WalletStatus;
  type: WalletType;
  updatedAt: Scalars['AWSDateTime']['output'];
  userId: Scalars['ID']['output'];
};

export type WalletStatus =
  | 'ACTIVE'
  | 'CLOSED'
  | 'SUSPENDED';

export type WalletType =
  | 'CRYPTO'
  | 'FIAT';

export type WebhookResponse = {
  __typename?: 'WebhookResponse';
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};
