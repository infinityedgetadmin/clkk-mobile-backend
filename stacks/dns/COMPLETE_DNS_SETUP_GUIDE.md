# Complete Multi-Account DNS and Custom Domain Setup Guide

**Last Updated: 2025-01-02**
**Author: Implementation based on real deployment experience**

This guide provides a complete, battle-tested approach to setting up DNS and custom domains across multiple AWS accounts. It includes all errors encountered during implementation and their solutions.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Step-by-Step Implementation](#step-by-step-implementation)
5. [Common Errors and Solutions](#common-errors-and-solutions)
6. [Testing and Verification](#testing-and-verification)
7. [Reference Documents](#reference-documents)

## Overview

This guide covers setting up a centralized DNS architecture where:
- **Production account** hosts Route53 and all SSL certificates
- **Environment accounts** (dev/staging/prod) host the actual services
- **Cross-account access** allows services to create DNS records
- **Custom domains** work for both AppSync GraphQL and REST APIs

### What We Built Today

- Deployed a GraphQL API with custom domain `mobile.dev.clkk-api.io`
- Set up cross-account DNS management
- Created certificates in both production and dev accounts
- Implemented automatic DNS record creation

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Production Account (422160113808)              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                    Platform Stack                       │     │
│  │  • Route53 Hosted Zone (clkk-api.io)                   │     │
│  │  • SSL Certificates (mobile.*.clkk-api.io)             │     │
│  │  • SSM Parameters (/clkk/platform/*)                   │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              Cross-Account DNS Role                     │     │
│  │  • Allows dev/staging/prod to manage DNS               │     │
│  │  • Limited to specific hosted zone                     │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                                    │
                          Cross-Account Access
                                    │
┌─────────────────────────────────────────────────────────────────┐
│                    Dev Account (741448914938)                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │              Cross-Account DNS Lambda                   │     │
│  │  • Assumes role in production                           │     │
│  │  • Creates/updates/deletes DNS records                 │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │                  GraphQL API Stack                      │     │
│  │  • AppSync API                                          │     │
│  │  • Local SSL Certificate (for AppSync)                 │     │
│  │  • Custom Domain Association                           │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### AWS Accounts
- Production account with domain management permissions
- Separate accounts for each environment (recommended)
- AWS CLI profiles configured for each account

### Tools Required
- AWS CLI v2
- SAM CLI
- jq (for JSON parsing)
- dig/nslookup (for DNS verification)

### AWS Profiles Setup
```bash
# ~/.aws/config
[profile clkk-saas-prod]
region = us-east-1
account_id = 422160113808

[profile clkk-mobile-dev]
region = us-east-1
account_id = 741448914938
```

## Step-by-Step Implementation

### Phase 1: Platform Stack in Production Account

#### 1.1 Deploy Platform Stack

The platform stack creates the Route53 hosted zone and certificates.

```bash
cd stacks/platform

AWS_PROFILE=clkk-saas-prod sam deploy \
  --stack-name clkk-platform-stack \
  --template-file platform-stack.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    Environment=prod \
    DomainName=clkk-api.io \
  --no-confirm-changeset \
  --region us-east-1
```

**Key Files:**
- `stacks/platform/platform-stack.yaml` - Main platform infrastructure
- `stacks/platform/README.md` - Platform documentation
- `stacks/platform/PARAMETERS.md` - SSM parameter reference

#### 1.2 Configure Domain Nameservers

After deployment, update your domain registrar with AWS nameservers:

```bash
# Get nameservers
AWS_PROFILE=clkk-saas-prod aws cloudformation describe-stacks \
  --stack-name clkk-platform-stack \
  --query 'Stacks[0].Outputs[?OutputKey==`HostedZoneNameServers`].OutputValue' \
  --output text
```

### Phase 2: Cross-Account DNS Infrastructure

#### 2.1 Deploy Cross-Account Role in Production

This role allows environment accounts to manage DNS records.

```bash
cd stacks/dns/roles

AWS_PROFILE=clkk-saas-prod sam deploy \
  --stack-name clkk-cross-account-dns-role-mobile \
  --template-file prod-account-dns-role-mobile.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    MobileDevAccountId=741448914938 \
    MobileStagingAccountId=YOUR_STAGING_ACCOUNT \
    MobileProdAccountId=YOUR_PROD_ACCOUNT \
  --no-confirm-changeset \
  --region us-east-1
```

**Important:** Note the role ARN from the output - you'll need it for the next step.

#### 2.2 Deploy DNS Lambda in Environment Account

This Lambda function manages DNS records in the production account.

```bash
AWS_PROFILE=clkk-mobile-dev sam deploy \
  --stack-name clkk-mobile-cross-account-dns-dev \
  --template-file cross-account-dns-resource-mobile.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Environment=dev \
  --no-confirm-changeset \
  --region us-east-1
```

### Phase 3: Application Deployment

#### 3.1 Deploy Your Application

```bash
cd /path/to/your/app

# Build the application
sam build

# Deploy with resolve-s3 to avoid bucket naming conflicts
AWS_PROFILE=clkk-mobile-dev sam deploy \
  --stack-name clkk-mobile-backend-dev \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND CAPABILITY_NAMED_IAM \
  --parameter-overrides Environment=dev \
  --no-confirm-changeset \
  --region us-east-1 \
  --resolve-s3
```

**Note the GraphQL API ID from the output!**

### Phase 4: SSL Certificates

#### 4.1 For AppSync (Certificate in Same Account)

AppSync requires the certificate to be in the same account as the API.

```bash
# Request certificate in dev account
AWS_PROFILE=clkk-mobile-dev aws acm request-certificate \
  --domain-name mobile.dev.clkk-api.io \
  --validation-method DNS \
  --region us-east-1
```

#### 4.2 Validate Certificate

Get the validation record and add it to Route53:

```bash
# Get certificate ARN from previous command
CERT_ARN="arn:aws:acm:us-east-1:741448914938:certificate/YOUR-CERT-ID"

# Get validation record
AWS_PROFILE=clkk-mobile-dev aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
  --region us-east-1
```

Create validation record in production account:

```bash
# Create DNS validation record
cat > /tmp/dns-validation.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "_VALIDATION_RECORD_NAME_",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{
        "Value": "_VALIDATION_RECORD_VALUE_"
      }]
    }
  }]
}
EOF

AWS_PROFILE=clkk-saas-prod aws route53 change-resource-record-sets \
  --hosted-zone-id Z07794393NL0TD72QHLLD \
  --change-batch file:///tmp/dns-validation.json
```

Wait for validation:

```bash
AWS_PROFILE=clkk-mobile-dev aws acm wait certificate-validated \
  --certificate-arn $CERT_ARN \
  --region us-east-1
```

### Phase 5: Custom Domain Deployment

#### 5.1 Deploy Custom Domain Stack

```bash
cd stacks/dns

AWS_PROFILE=clkk-mobile-dev sam deploy \
  --stack-name clkk-mobile-backend-custom-domain-dev \
  --template-file custom-domain-with-lambda.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    Environment=dev \
    RootDomain=clkk-api.io \
    HostedZoneId=Z07794393NL0TD72QHLLD \
    CertificateArn=$CERT_ARN \
    GraphQLApiId=YOUR_GRAPHQL_API_ID \
    CrossAccountDnsFunctionArn=arn:aws:lambda:us-east-1:741448914938:function:dev-clkk-mobile-cross-account-dns \
  --no-confirm-changeset \
  --region us-east-1
```

## Common Errors and Solutions

### Error 1: Certificate Must Be in Same Account

**Error:**
```
Resource handler returned message: "Invalid request provided: Certificate must be in the same account as the domain name."
```

**Cause:** AppSync requires certificates to be in the same AWS account.

**Solution:** Create the certificate in the environment account, not the production account.

### Error 2: TTL Type Error in Lambda

**Error:**
```
Invalid type for parameter ChangeBatch.Changes[0].ResourceRecordSet.TTL, value: 300, type: <class 'str'>, valid types: <class 'int'>
```

**Cause:** CloudFormation passes numeric parameters as strings to Lambda.

**Solution:** Convert TTL to integer in Lambda code:
```python
change_batch['Changes'][0]['ResourceRecordSet']['TTL'] = int(properties.get('TTL', 300))
```

### Error 3: Missing Capabilities

**Error:**
```
Requires capabilities : [CAPABILITY_NAMED_IAM]
```

**Cause:** Stack creates IAM roles with custom names.

**Solution:** Add all required capabilities:
```bash
--capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND CAPABILITY_NAMED_IAM
```

### Error 4: S3 Bucket Already Exists

**Error:**
```
clkk-mobile-backend-uploads-dev already exists
```

**Cause:** S3 bucket names must be globally unique.

**Solution:** Use `--resolve-s3` flag to auto-generate unique names:
```bash
sam deploy --resolve-s3
```

### Error 5: DynamoDB Table Already Exists

**Error:**
```
Table already exists: clkk-mobile-backend-dev-app-table
```

**Cause:** Previous deployment wasn't cleaned up properly.

**Solution:** Delete the table before redeploying:
```bash
aws dynamodb delete-table --table-name clkk-mobile-backend-dev-app-table
```

### Error 6: Stack in ROLLBACK_COMPLETE State

**Error:**
```
Stack:arn:aws:cloudformation:... is in ROLLBACK_COMPLETE state and can not be updated
```

**Solution:** Delete and recreate the stack:
```bash
aws cloudformation delete-stack --stack-name STACK_NAME
aws cloudformation wait stack-delete-complete --stack-name STACK_NAME
```

### Error 7: Cross-Account Access Denied

**Error:**
```
User: arn:aws:iam::741448914938:user/dev-mh is not authorized to access this resource
```

**Cause:** Environment account doesn't have permission to access production resources.

**Solution:** Deploy cross-account role and use Lambda function for DNS management.

## Testing and Verification

### 1. Verify DNS Resolution

```bash
# Check CNAME record
dig mobile.dev.clkk-api.io CNAME +short

# Should return something like:
# d33ioxo9sjxo5l.cloudfront.net.
```

### 2. Test GraphQL Endpoint

```bash
# Get API key
AWS_PROFILE=clkk-mobile-dev aws appsync list-api-keys \
  --api-id YOUR_API_ID \
  --query 'apiKeys[0].id' \
  --output text

# Test the endpoint
curl -X POST https://mobile.dev.clkk-api.io/graphql \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{"query": "{ health }"}'
```

### 3. Verify Certificate Status

```bash
AWS_PROFILE=clkk-mobile-dev aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --query 'Certificate.Status' \
  --output text
```

## Reference Documents

### In This Repository

1. **[AWS_MULTI_ACCOUNT_DNS_GUIDE.md](./AWS_MULTI_ACCOUNT_DNS_GUIDE.md)**
   - Generic guide for any AWS project
   - Architectural patterns and best practices

2. **[IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md)**
   - Specific details about this implementation
   - Lessons learned and decisions made

3. **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)**
   - Common commands and snippets
   - Troubleshooting cheat sheet

4. **[ERROR_SOLUTIONS.md](./ERROR_SOLUTIONS.md)**
   - Comprehensive error catalog
   - Step-by-step solutions

### Stack Templates

- `stacks/platform/platform-stack.yaml` - Main platform infrastructure
- `stacks/dns/roles/prod-account-dns-role-mobile.yaml` - Cross-account role
- `stacks/dns/roles/cross-account-dns-resource-mobile.yaml` - DNS Lambda
- `stacks/dns/custom-domain-with-lambda.yaml` - Custom domain setup

## Next Steps

### For Staging Environment

1. Add staging account ID to the cross-account role
2. Deploy DNS Lambda in staging account
3. Create certificate in staging account
4. Deploy custom domain stack

### For Production Environment

1. Follow same pattern as staging
2. Consider using CloudFront for additional security
3. Implement monitoring and alerting

## Summary

This architecture provides:
- ✅ Centralized DNS management
- ✅ Environment isolation
- ✅ Automatic SSL certificate management
- ✅ Support for both GraphQL and REST APIs
- ✅ Cross-account security
- ✅ Scalable pattern for multiple environments

The key to success is understanding the limitations (like AppSync requiring same-account certificates) and implementing the appropriate workarounds.