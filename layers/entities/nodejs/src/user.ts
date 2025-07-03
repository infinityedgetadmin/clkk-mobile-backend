import { v4 as uuidv4 } from 'uuid';
import { ATTRIBUTES, KEY_BUILDERS, ENTITY_TYPES } from 'constants';

export interface UserData {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  clerkId?: string;
  cybridGuid?: string;
  clkkTag?: string;
  kycStatus?: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
  onboardingStatus?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  createdAt?: string;
  updatedAt?: string;
}

export class User implements UserData {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  clerkId?: string;
  cybridGuid?: string;
  clkkTag?: string;
  kycStatus?: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
  onboardingStatus?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  createdAt: string;
  updatedAt: string;

  constructor(data: UserData) {
    // Validate email
    if (data.email && !this.isValidEmail(data.email)) {
      throw new Error('Invalid email format');
    }

    // Validate phone number
    if (data.phoneNumber && !this.isValidPhoneNumber(data.phoneNumber)) {
      throw new Error('Invalid phone number format');
    }

    // Validate KYC status
    if (data.kycStatus && !this.isValidKycStatus(data.kycStatus)) {
      throw new Error('Invalid KYC status');
    }

    this.userId = data.userId || uuidv4();
    this.email = data.email;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.phoneNumber = data.phoneNumber;
    this.clerkId = data.clerkId;
    this.cybridGuid = data.cybridGuid;
    this.clkkTag = data.clkkTag;
    this.kycStatus = data.kycStatus;
    this.onboardingStatus = data.onboardingStatus;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  private isValidKycStatus(status: string): boolean {
    return ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED'].includes(status);
  }

  toDynamoDBItem(): Record<string, any> {
    const keys = KEY_BUILDERS.user(this.userId);
    const item: Record<string, any> = {
      ...keys,
      [ATTRIBUTES.ENTITY_TYPE]: ENTITY_TYPES.USER,
      [ATTRIBUTES.USER_ID]: this.userId,
      [ATTRIBUTES.EMAIL]: this.email,
      [ATTRIBUTES.CREATED_AT]: this.createdAt,
      [ATTRIBUTES.UPDATED_AT]: this.updatedAt,
    };

    // Add optional fields
    if (this.firstName) item[ATTRIBUTES.FIRST_NAME] = this.firstName;
    if (this.lastName) item[ATTRIBUTES.LAST_NAME] = this.lastName;
    if (this.phoneNumber) item[ATTRIBUTES.PHONE_NUMBER] = this.phoneNumber;
    if (this.clerkId) {
      item[ATTRIBUTES.CLERK_ID] = this.clerkId;
      item[ATTRIBUTES.EXTERNAL_ID_KEY] = KEY_BUILDERS.externalId('CLERK', this.clerkId)[ATTRIBUTES.EXTERNAL_ID_KEY];
    }
    if (this.cybridGuid) item[ATTRIBUTES.CYBRID_GUID] = this.cybridGuid;
    if (this.clkkTag) {
      item[ATTRIBUTES.CLKK_TAG] = this.clkkTag;
      item[ATTRIBUTES.CLKK_TAG_KEY] = this.clkkTag;
    }
    if (this.kycStatus) item[ATTRIBUTES.KYC_STATUS] = this.kycStatus;
    if (this.onboardingStatus) item[ATTRIBUTES.ONBOARDING_STATUS] = this.onboardingStatus;
    if (this.email) item[ATTRIBUTES.EMAIL_KEY] = this.email;

    return item;
  }

  static fromDynamoDBItem(item: Record<string, any>): User {
    return new User({
      userId: item[ATTRIBUTES.USER_ID] || item.UserId,
      email: item[ATTRIBUTES.EMAIL] || item.Email,
      firstName: item[ATTRIBUTES.FIRST_NAME] || item.FirstName,
      lastName: item[ATTRIBUTES.LAST_NAME] || item.LastName,
      phoneNumber: item[ATTRIBUTES.PHONE_NUMBER] || item.PhoneNumber,
      clerkId: item[ATTRIBUTES.CLERK_ID] || item.ClerkId,
      cybridGuid: item[ATTRIBUTES.CYBRID_GUID] || item.CybridGuid,
      clkkTag: item[ATTRIBUTES.CLKK_TAG] || item.ClkkTag,
      kycStatus: item[ATTRIBUTES.KYC_STATUS] || item.KycStatus,
      onboardingStatus: item[ATTRIBUTES.ONBOARDING_STATUS] || item.OnboardingStatus,
      createdAt: item[ATTRIBUTES.CREATED_AT] || item.CreatedAt,
      updatedAt: item[ATTRIBUTES.UPDATED_AT] || item.UpdatedAt,
    });
  }

  toGraphQL(): any {
    return {
      id: this.userId,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      phoneNumber: this.phoneNumber,
      clkkTag: this.clkkTag,
      kycStatus: this.kycStatus,
      onboardingStatus: this.onboardingStatus,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}