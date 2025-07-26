# AWS Multi-Account DNS and Certificate Management Guide

**Last Updated: 2025-01-02**

This guide provides a comprehensive, step-by-step approach to implementing DNS and SSL certificate management across multiple AWS accounts for different environments. This pattern is commonly used in enterprise architectures where production, staging, and development environments are isolated in separate AWS accounts.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Create Platform Stack in Production Account](#step-1-create-platform-stack-in-production-account)
4. [Step 2: Set Up Cross-Account DNS Management](#step-2-set-up-cross-account-dns-management)
5. [Step 3: Implement Custom Domains for Services](#step-3-implement-custom-domains-for-services)
6. [Step 4: Deploy to Multiple Environments](#step-4-deploy-to-multiple-environments)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Production AWS Account                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                     Platform Stack                           │  │
│  │                                                             │  │
│  │  • Route 53 Hosted Zone (example.com)                      │  │
│  │  • SSL Certificates (ACM)                                  │  │
│  │    - api.example.com                                       │  │
│  │    - api.staging.example.com                               │  │
│  │    - api.dev.example.com                                   │  │
│  │    - graphql.example.com                                   │  │
│  │    - graphql.staging.example.com                           │  │
│  │    - graphql.dev.example.com                               │  │
│  │  • SSM Parameters (for cross-stack references)             │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Cross-Account Access
                                    ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   Dev Account       │  │  Staging Account    │  │   Prod Account      │
│                     │  │                     │  │                     │
│ • API Gateway       │  │ • API Gateway       │  │ • API Gateway       │
│ • AppSync GraphQL   │  │ • AppSync GraphQL   │  │ • AppSync GraphQL   │
│ • Lambda DNS Writer │  │ • Lambda DNS Writer │  │ • Lambda DNS Writer │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

## Prerequisites

1. **AWS Accounts**:
   - Production account (hosts DNS and certificates)
   - Separate accounts for each environment (optional but recommended)

2. **Domain**:
   - Domain registered (can be in Route 53 or external registrar)
   - Access to update nameservers

3. **AWS CLI and Tools**:
   - AWS CLI configured with appropriate profiles
   - SAM CLI installed
   - Appropriate IAM permissions in each account

4. **Required IAM Permissions**:
   - Production account: Route 53, ACM, SSM Parameter Store
   - Environment accounts: Lambda, API Gateway/AppSync, CloudFormation

## Step 1: Create Platform Stack in Production Account

The platform stack centralizes DNS and certificate management in the production account.

### 1.1 Create the Platform Stack Template

Create `platform-stack.yaml`:

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Transform: AWS::Serverless-2016-10-31
Description: "Platform Infrastructure - Shared DNS and Certificates"

Parameters:
  Environment:
    Type: String
    Default: "prod"
    Description: "Should always be 'prod' for platform stack"
    AllowedValues:
      - prod
  
  DomainName:
    Type: String
    Description: "Root domain name (e.g., example.com)"

Conditions:
  IsProduction: !Equals [!Ref Environment, "prod"]

Resources:
  # ================================================
  # ROUTE 53 HOSTED ZONE
  # ================================================
  HostedZone:
    Type: AWS::Route53::HostedZone
    Condition: IsProduction
    Properties:
      Name: !Ref DomainName
      HostedZoneConfig:
        Comment: !Sub "Platform hosted zone for ${DomainName}"

  # ================================================
  # SSL CERTIFICATES FOR MULTIPLE SERVICES
  # ================================================
  
  # API Certificates (for REST APIs)
  ProductionApiCertificate:
    Type: AWS::CertificateManager::Certificate
    Condition: IsProduction
    Properties:
      DomainName: !Sub "api.${DomainName}"
      ValidationMethod: DNS
      DomainValidationOptions:
        - DomainName: !Sub "api.${DomainName}"
          HostedZoneId: !Ref HostedZone

  StagingApiCertificate:
    Type: AWS::CertificateManager::Certificate
    Condition: IsProduction
    Properties:
      DomainName: !Sub "api.staging.${DomainName}"
      ValidationMethod: DNS
      DomainValidationOptions:
        - DomainName: !Sub "api.staging.${DomainName}"
          HostedZoneId: !Ref HostedZone

  DevelopmentApiCertificate:
    Type: AWS::CertificateManager::Certificate
    Condition: IsProduction
    Properties:
      DomainName: !Sub "api.dev.${DomainName}"
      ValidationMethod: DNS
      DomainValidationOptions:
        - DomainName: !Sub "api.dev.${DomainName}"
          HostedZoneId: !Ref HostedZone

  # GraphQL Certificates (for AppSync)
  ProductionGraphQLCertificate:
    Type: AWS::CertificateManager::Certificate
    Condition: IsProduction
    Properties:
      DomainName: !Sub "graphql.${DomainName}"
      ValidationMethod: DNS
      DomainValidationOptions:
        - DomainName: !Sub "graphql.${DomainName}"
          HostedZoneId: !Ref HostedZone

  StagingGraphQLCertificate:
    Type: AWS::CertificateManager::Certificate
    Condition: IsProduction
    Properties:
      DomainName: !Sub "graphql.staging.${DomainName}"
      ValidationMethod: DNS
      DomainValidationOptions:
        - DomainName: !Sub "graphql.staging.${DomainName}"
          HostedZoneId: !Ref HostedZone

  DevelopmentGraphQLCertificate:
    Type: AWS::CertificateManager::Certificate
    Condition: IsProduction
    Properties:
      DomainName: !Sub "graphql.dev.${DomainName}"
      ValidationMethod: DNS
      DomainValidationOptions:
        - DomainName: !Sub "graphql.dev.${DomainName}"
          HostedZoneId: !Ref HostedZone

  # ================================================
  # SSM PARAMETERS FOR CROSS-ACCOUNT ACCESS
  # ================================================
  
  HostedZoneIdParameter:
    Type: AWS::SSM::Parameter
    Condition: IsProduction
    Properties:
      Name: !Sub "/${AWS::StackName}/hosted-zone-id"
      Type: String
      Value: !Ref HostedZone
      Description: "Route 53 Hosted Zone ID"

  DomainNameParameter:
    Type: AWS::SSM::Parameter
    Condition: IsProduction
    Properties:
      Name: !Sub "/${AWS::StackName}/domain-name"
      Type: String
      Value: !Ref DomainName
      Description: "Root domain name"

  # API Certificate Parameters
  ProductionApiCertificateParameter:
    Type: AWS::SSM::Parameter
    Condition: IsProduction
    Properties:
      Name: !Sub "/${AWS::StackName}/certificates/api/prod"
      Type: String
      Value: !Ref ProductionApiCertificate

  StagingApiCertificateParameter:
    Type: AWS::SSM::Parameter
    Condition: IsProduction
    Properties:
      Name: !Sub "/${AWS::StackName}/certificates/api/staging"
      Type: String
      Value: !Ref StagingApiCertificate

  DevelopmentApiCertificateParameter:
    Type: AWS::SSM::Parameter
    Condition: IsProduction
    Properties:
      Name: !Sub "/${AWS::StackName}/certificates/api/dev"
      Type: String
      Value: !Ref DevelopmentApiCertificate

  # GraphQL Certificate Parameters
  ProductionGraphQLCertificateParameter:
    Type: AWS::SSM::Parameter
    Condition: IsProduction
    Properties:
      Name: !Sub "/${AWS::StackName}/certificates/graphql/prod"
      Type: String
      Value: !Ref ProductionGraphQLCertificate

  StagingGraphQLCertificateParameter:
    Type: AWS::SSM::Parameter
    Condition: IsProduction
    Properties:
      Name: !Sub "/${AWS::StackName}/certificates/graphql/staging"
      Type: String
      Value: !Ref StagingGraphQLCertificate

  DevelopmentGraphQLCertificateParameter:
    Type: AWS::SSM::Parameter
    Condition: IsProduction
    Properties:
      Name: !Sub "/${AWS::StackName}/certificates/graphql/dev"
      Type: String
      Value: !Ref DevelopmentGraphQLCertificate

Outputs:
  HostedZoneId:
    Description: "Route 53 Hosted Zone ID"
    Value: !If [IsProduction, !Ref HostedZone, "N/A"]
    Export:
      Name: !Sub "${AWS::StackName}-hosted-zone-id"

  HostedZoneNameServers:
    Description: "Configure these nameservers with your domain registrar"
    Value: !If 
      - IsProduction
      - !Join [", ", !GetAtt HostedZone.NameServers]
      - "N/A"

  DomainName:
    Description: "Root domain name"
    Value: !Ref DomainName
    Export:
      Name: !Sub "${AWS::StackName}-domain-name"
```

### 1.2 Deploy the Platform Stack

```bash
# Deploy to production account
AWS_PROFILE=production-profile sam deploy \
  --stack-name platform-stack \
  --template-file platform-stack.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    Environment=prod \
    DomainName=example.com \
  --region us-east-1
```

### 1.3 Configure Domain Nameservers

After deployment:

1. Get the nameservers from CloudFormation outputs
2. Update your domain registrar to use these AWS nameservers
3. Wait for DNS propagation (can take up to 48 hours)

## Step 2: Set Up Cross-Account DNS Management

For services in different AWS accounts to create DNS records, they need cross-account access.

### 2.1 Create Cross-Account IAM Role (in Production Account)

Create `cross-account-dns-role.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Cross-account role for DNS management'

Parameters:
  TrustedAccountId:
    Type: String
    Description: "AWS Account ID that can assume this role"
  
  HostedZoneId:
    Type: String
    Description: "Route 53 Hosted Zone ID to manage"

Resources:
  CrossAccountDnsRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub "CrossAccountDnsRole-${TrustedAccountId}"
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              AWS: !Sub "arn:aws:iam::${TrustedAccountId}:root"
            Action: 'sts:AssumeRole'
      Policies:
        - PolicyName: Route53Access
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - 'route53:ChangeResourceRecordSets'
                  - 'route53:GetHostedZone'
                  - 'route53:ListResourceRecordSets'
                Resource:
                  - !Sub 'arn:aws:route53:::hostedzone/${HostedZoneId}'
              - Effect: Allow
                Action:
                  - 'route53:GetChange'
                Resource: '*'

Outputs:
  RoleArn:
    Description: "ARN of the cross-account role"
    Value: !GetAtt CrossAccountDnsRole.Arn
```

Deploy for each environment account:

```bash
# For development account
AWS_PROFILE=production-profile sam deploy \
  --stack-name cross-account-dns-dev \
  --template-file cross-account-dns-role.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    TrustedAccountId=123456789012 \
    HostedZoneId=Z1234567890ABC
```

### 2.2 Create DNS Management Lambda (in Environment Accounts)

Create `dns-manager-lambda.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: 'Lambda function for cross-account DNS management'

Parameters:
  CrossAccountRoleArn:
    Type: String
    Description: "ARN of the role in production account"
  
  HostedZoneId:
    Type: String
    Description: "Route 53 Hosted Zone ID"

Resources:
  DnsManagerFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: dns-manager
      Runtime: python3.11
      Handler: index.handler
      Timeout: 60
      MemorySize: 256
      Environment:
        Variables:
          CROSS_ACCOUNT_ROLE_ARN: !Ref CrossAccountRoleArn
          HOSTED_ZONE_ID: !Ref HostedZoneId
      Policies:
        - Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - 'sts:AssumeRole'
              Resource: !Ref CrossAccountRoleArn
      InlineCode: |
        import json
        import boto3
        import os
        import cfnresponse

        def handler(event, context):
            """
            Custom resource handler for DNS record management
            """
            try:
                request_type = event['RequestType']
                properties = event['ResourceProperties']
                
                # Assume cross-account role
                sts = boto3.client('sts')
                assumed_role = sts.assume_role(
                    RoleArn=os.environ['CROSS_ACCOUNT_ROLE_ARN'],
                    RoleSessionName='DnsManager'
                )
                
                # Create Route53 client with assumed credentials
                route53 = boto3.client(
                    'route53',
                    aws_access_key_id=assumed_role['Credentials']['AccessKeyId'],
                    aws_secret_access_key=assumed_role['Credentials']['SecretAccessKey'],
                    aws_session_token=assumed_role['Credentials']['SessionToken']
                )
                
                hosted_zone_id = os.environ['HOSTED_ZONE_ID']
                record_name = properties['RecordName']
                record_type = properties.get('RecordType', 'CNAME')
                record_value = properties['RecordValue']
                ttl = int(properties.get('TTL', 300))
                
                if request_type in ['Create', 'Update']:
                    # Create/Update DNS record
                    change_batch = {
                        'Changes': [{
                            'Action': 'UPSERT',
                            'ResourceRecordSet': {
                                'Name': record_name,
                                'Type': record_type,
                                'TTL': ttl,
                                'ResourceRecords': [{'Value': record_value}]
                            }
                        }]
                    }
                    
                    response = route53.change_resource_record_sets(
                        HostedZoneId=hosted_zone_id,
                        ChangeBatch=change_batch
                    )
                    
                    physical_id = f"{record_name}-{record_type}"
                    
                elif request_type == 'Delete':
                    # Delete DNS record
                    try:
                        # Get current record to delete
                        records = route53.list_resource_record_sets(
                            HostedZoneId=hosted_zone_id,
                            StartRecordName=record_name,
                            StartRecordType=record_type,
                            MaxItems='1'
                        )
                        
                        if records['ResourceRecordSets']:
                            record = records['ResourceRecordSets'][0]
                            if record['Name'].rstrip('.') == record_name.rstrip('.'):
                                change_batch = {
                                    'Changes': [{
                                        'Action': 'DELETE',
                                        'ResourceRecordSet': record
                                    }]
                                }
                                
                                route53.change_resource_record_sets(
                                    HostedZoneId=hosted_zone_id,
                                    ChangeBatch=change_batch
                                )
                    except Exception as e:
                        print(f"Error deleting record: {e}")
                    
                    physical_id = event['PhysicalResourceId']
                
                cfnresponse.send(event, context, cfnresponse.SUCCESS, {}, physical_id)
                
            except Exception as e:
                print(f"Error: {e}")
                cfnresponse.send(event, context, cfnresponse.FAILED, {}, 
                               event.get('PhysicalResourceId', 'unknown'))

Outputs:
  FunctionArn:
    Description: "DNS Manager Lambda ARN"
    Value: !GetAtt DnsManagerFunction.Arn
    Export:
      Name: !Sub "${AWS::StackName}-function-arn"
```

## Step 3: Implement Custom Domains for Services

### 3.1 For AppSync GraphQL APIs

Create `graphql-custom-domain.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: 'Custom domain for AppSync GraphQL API'

Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, staging, prod]
  
  GraphQLApiId:
    Type: String
    Description: "AppSync GraphQL API ID"
  
  DomainName:
    Type: String
    Description: "Root domain (e.g., example.com)"
  
  CertificateArn:
    Type: String
    Description: "ACM Certificate ARN from platform stack"
  
  DnsManagerFunctionArn:
    Type: String
    Description: "DNS Manager Lambda ARN"

Resources:
  # AppSync Domain Name
  GraphQLDomainName:
    Type: AWS::AppSync::DomainName
    Properties:
      DomainName: !If
        - IsProd
        - !Sub "graphql.${DomainName}"
        - !Sub "graphql.${Environment}.${DomainName}"
      CertificateArn: !Ref CertificateArn
      Description: !Sub "GraphQL API domain for ${Environment}"

  # Associate domain with API
  GraphQLDomainAssociation:
    Type: AWS::AppSync::DomainNameApiAssociation
    Properties:
      ApiId: !Ref GraphQLApiId
      DomainName: !Ref GraphQLDomainName

  # Create DNS record using Lambda
  DnsRecord:
    Type: Custom::DnsRecord
    Properties:
      ServiceToken: !Ref DnsManagerFunctionArn
      RecordName: !GetAtt GraphQLDomainName.DomainName
      RecordType: CNAME
      RecordValue: !GetAtt GraphQLDomainName.AppSyncDomainName
      TTL: 300

Conditions:
  IsProd: !Equals [!Ref Environment, prod]

Outputs:
  GraphQLEndpoint:
    Description: "Custom GraphQL endpoint"
    Value: !Sub "https://${GraphQLDomainName.DomainName}/graphql"
```

### 3.2 For REST APIs (API Gateway)

Create `api-custom-domain.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: 'Custom domain for API Gateway'

Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, staging, prod]
  
  ApiId:
    Type: String
    Description: "API Gateway API ID"
  
  ApiStage:
    Type: String
    Default: "v1"
  
  DomainName:
    Type: String
    Description: "Root domain (e.g., example.com)"
  
  CertificateArn:
    Type: String
    Description: "ACM Certificate ARN"
  
  DnsManagerFunctionArn:
    Type: String
    Description: "DNS Manager Lambda ARN"

Resources:
  # API Gateway Custom Domain
  ApiDomainName:
    Type: AWS::ApiGateway::DomainName
    Properties:
      DomainName: !If
        - IsProd
        - !Sub "api.${DomainName}"
        - !Sub "api.${Environment}.${DomainName}"
      RegionalCertificateArn: !Ref CertificateArn
      EndpointConfiguration:
        Types:
          - REGIONAL
      SecurityPolicy: TLS_1_2

  # Base path mapping
  ApiBasePathMapping:
    Type: AWS::ApiGateway::BasePathMapping
    Properties:
      DomainName: !Ref ApiDomainName
      RestApiId: !Ref ApiId
      Stage: !Ref ApiStage

  # DNS record
  ApiDnsRecord:
    Type: Custom::DnsRecord
    Properties:
      ServiceToken: !Ref DnsManagerFunctionArn
      RecordName: !GetAtt ApiDomainName.DomainName
      RecordType: CNAME
      RecordValue: !GetAtt ApiDomainName.RegionalDomainName
      TTL: 300

Conditions:
  IsProd: !Equals [!Ref Environment, prod]

Outputs:
  ApiEndpoint:
    Description: "Custom API endpoint"
    Value: !Sub "https://${ApiDomainName}"
```

## Step 4: Deploy to Multiple Environments

### 4.1 Create Deployment Script

Create `deploy-with-custom-domain.sh`:

```bash
#!/bin/bash
set -e

# Configuration
ENVIRONMENT="${1:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="my-service"
PLATFORM_STACK_NAME="platform-stack"
PRODUCTION_ACCOUNT_ID="111111111111"  # Your production account ID

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate environment
case $ENVIRONMENT in
    dev|staging|prod)
        ;;
    *)
        print_error "Invalid environment: $ENVIRONMENT"
        exit 1
        ;;
esac

# Get platform parameters from production account
print_status "Fetching platform parameters..."

# For non-prod environments, you might need to assume a role
if [ "$ENVIRONMENT" != "prod" ]; then
    ASSUME_ROLE_ARN="arn:aws:iam::${PRODUCTION_ACCOUNT_ID}:role/ParameterReadRole"
    TEMP_CREDS=$(aws sts assume-role \
        --role-arn "$ASSUME_ROLE_ARN" \
        --role-session-name "deployment-${ENVIRONMENT}")
    
    export AWS_ACCESS_KEY_ID=$(echo $TEMP_CREDS | jq -r '.Credentials.AccessKeyId')
    export AWS_SECRET_ACCESS_KEY=$(echo $TEMP_CREDS | jq -r '.Credentials.SecretAccessKey')
    export AWS_SESSION_TOKEN=$(echo $TEMP_CREDS | jq -r '.Credentials.SessionToken')
fi

# Get parameters
DOMAIN_NAME=$(aws ssm get-parameter \
    --name "/${PLATFORM_STACK_NAME}/domain-name" \
    --query 'Parameter.Value' \
    --output text)

CERTIFICATE_ARN=$(aws ssm get-parameter \
    --name "/${PLATFORM_STACK_NAME}/certificates/graphql/${ENVIRONMENT}" \
    --query 'Parameter.Value' \
    --output text)

HOSTED_ZONE_ID=$(aws ssm get-parameter \
    --name "/${PLATFORM_STACK_NAME}/hosted-zone-id" \
    --query 'Parameter.Value' \
    --output text)

# Reset credentials if we assumed a role
if [ "$ENVIRONMENT" != "prod" ]; then
    unset AWS_ACCESS_KEY_ID
    unset AWS_SECRET_ACCESS_KEY
    unset AWS_SESSION_TOKEN
fi

print_status "Domain: $DOMAIN_NAME"
print_status "Certificate: $CERTIFICATE_ARN"

# Step 1: Deploy DNS Manager (if not exists)
print_status "Deploying DNS Manager..."
sam deploy \
    --stack-name "${STACK_NAME}-dns-manager" \
    --template-file dns-manager-lambda.yaml \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        CrossAccountRoleArn="arn:aws:iam::${PRODUCTION_ACCOUNT_ID}:role/CrossAccountDnsRole-${AWS_ACCOUNT_ID}" \
        HostedZoneId="$HOSTED_ZONE_ID" \
    --no-fail-on-empty-changeset

DNS_MANAGER_ARN=$(aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}-dns-manager" \
    --query 'Stacks[0].Outputs[?OutputKey==`FunctionArn`].OutputValue' \
    --output text)

# Step 2: Deploy main application
print_status "Deploying application..."
sam build
sam deploy \
    --stack-name "${STACK_NAME}-${ENVIRONMENT}" \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
    --parameter-overrides \
        Environment="$ENVIRONMENT" \
    --no-confirm-changeset

# Get API ID
GRAPHQL_API_ID=$(aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}-${ENVIRONMENT}" \
    --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiId`].OutputValue' \
    --output text)

# Step 3: Deploy custom domain
print_status "Deploying custom domain..."
sam deploy \
    --stack-name "${STACK_NAME}-custom-domain-${ENVIRONMENT}" \
    --template-file graphql-custom-domain.yaml \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        Environment="$ENVIRONMENT" \
        GraphQLApiId="$GRAPHQL_API_ID" \
        DomainName="$DOMAIN_NAME" \
        CertificateArn="$CERTIFICATE_ARN" \
        DnsManagerFunctionArn="$DNS_MANAGER_ARN" \
    --no-fail-on-empty-changeset

# Get custom domain endpoint
CUSTOM_DOMAIN=$(aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}-custom-domain-${ENVIRONMENT}" \
    --query 'Stacks[0].Outputs[?OutputKey==`GraphQLEndpoint`].OutputValue' \
    --output text)

print_status "Deployment complete!"
print_status "GraphQL endpoint: $CUSTOM_DOMAIN"
```

### 4.2 Environment-Specific Deployment

```bash
# Deploy to development
./deploy-with-custom-domain.sh dev

# Deploy to staging
./deploy-with-custom-domain.sh staging

# Deploy to production
./deploy-with-custom-domain.sh prod
```

## Security Best Practices

### 1. Least Privilege Access

```yaml
# Only allow specific actions needed
PolicyDocument:
  Version: '2012-10-17'
  Statement:
    - Effect: Allow
      Action:
        - 'route53:ChangeResourceRecordSets'
      Resource:
        - !Sub 'arn:aws:route53:::hostedzone/${HostedZoneId}'
      Condition:
        ForAllValues:StringEquals:
          'route53:ChangeResourceRecordSetsRecordTypes': ['CNAME']
          'route53:ChangeResourceRecordSetsActions': ['UPSERT', 'DELETE']
```

### 2. Use Parameter Store for Sensitive Data

```yaml
# Store certificate ARNs and other sensitive data
CertificateArnParameter:
  Type: AWS::SSM::Parameter
  Properties:
    Name: !Sub "/${AWS::StackName}/certificate-arn"
    Type: String
    Value: !Ref Certificate
    Tier: Standard
    Policies: |
      {
        "Version": "2012-10-17",
        "Statement": [{
          "Effect": "Allow",
          "Principal": {
            "AWS": [
              "arn:aws:iam::123456789012:root",
              "arn:aws:iam::234567890123:root"
            ]
          },
          "Action": "ssm:GetParameter",
          "Resource": "*"
        }]
      }
```

### 3. Enable CloudTrail Logging

```yaml
# Log all DNS changes
DnsChangesTopic:
  Type: AWS::SNS::Topic
  Properties:
    DisplayName: DNS Changes
    Subscription:
      - Endpoint: security-team@example.com
        Protocol: email

Route53LogGroup:
  Type: AWS::Logs::LogGroup
  Properties:
    LogGroupName: /aws/route53/changes
    RetentionInDays: 90
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Certificate Validation Fails

**Problem**: ACM certificate stuck in "Pending Validation"

**Solution**:
- Ensure nameservers are correctly configured
- Check DNS propagation: `dig example.com NS`
- Verify Route 53 hosted zone has DNS validation records

#### 2. Cross-Account Access Denied

**Problem**: Lambda cannot assume role in production account

**Solution**:
```bash
# Check trust relationship
aws iam get-role --role-name CrossAccountDnsRole --query 'Role.AssumeRolePolicyDocument'

# Verify account ID in trust policy matches
```

#### 3. Custom Domain Not Working

**Problem**: Custom domain returns 403 or not found

**Solution**:
- Wait for DNS propagation (5-10 minutes)
- Verify certificate covers the domain
- Check API Gateway/AppSync association
- Test DNS resolution: `nslookup graphql.example.com`

#### 4. Lambda Timeout During DNS Update

**Problem**: DNS manager Lambda times out

**Solution**:
- Increase Lambda timeout (max 60 seconds for custom resources)
- Check Route 53 API throttling
- Verify cross-account role permissions

### Debug Commands

```bash
# Check certificate status
aws acm describe-certificate --certificate-arn $CERT_ARN

# List DNS records
aws route53 list-resource-record-sets --hosted-zone-id $ZONE_ID

# Check custom domain status (AppSync)
aws appsync get-domain-name --domain-name graphql.example.com

# Check custom domain status (API Gateway)
aws apigateway get-domain-name --domain-name api.example.com

# Test DNS resolution
dig graphql.example.com CNAME
nslookup graphql.example.com

# Check Lambda logs
aws logs tail /aws/lambda/dns-manager --follow
```

## Summary

This architecture provides:

1. **Centralized DNS Management**: All DNS and certificates in production account
2. **Environment Isolation**: Each environment in separate AWS account
3. **Automated Deployment**: Infrastructure as code for all components
4. **Security**: Least-privilege cross-account access
5. **Scalability**: Easy to add new environments or services
6. **Cost Optimization**: Shared resources in production account

The pattern works for:
- REST APIs (API Gateway)
- GraphQL APIs (AppSync)
- Static websites (CloudFront)
- Any AWS service supporting custom domains

Key benefits:
- Single source of truth for DNS
- Consistent SSL certificates across environments
- Automated DNS record management
- Clear separation of concerns
- Audit trail for all DNS changes