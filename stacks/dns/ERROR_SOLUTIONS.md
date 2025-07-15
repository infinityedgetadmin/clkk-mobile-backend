# DNS and Custom Domain Error Solutions Guide

**Last Updated: 2025-01-02**

This document catalogs all errors encountered during DNS and custom domain setup, with detailed solutions and prevention strategies.

## Table of Contents

1. [Certificate Errors](#certificate-errors)
2. [CloudFormation Errors](#cloudformation-errors)
3. [Cross-Account Access Errors](#cross-account-access-errors)
4. [Lambda Function Errors](#lambda-function-errors)
5. [DNS and Route53 Errors](#dns-and-route53-errors)
6. [AppSync Specific Errors](#appsync-specific-errors)
7. [S3 and Resource Naming Errors](#s3-and-resource-naming-errors)

## Certificate Errors

### Error: Certificate Must Be in Same Account

**Full Error:**
```
Resource handler returned message: "Invalid request provided: Certificate must be in the same account as the domain name. (Service: AppSync, Status Code: 400, Request ID: 9dafaa2b-4c84-415a-b46c-6f4e5c42394b)"
```

**Root Cause:**
- AppSync requires SSL certificates to be in the same AWS account as the GraphQL API
- This is different from API Gateway, which can use certificates from other accounts

**Solution:**
1. Request certificate in the environment account:
```bash
AWS_PROFILE=environment-profile aws acm request-certificate \
  --domain-name subdomain.domain.com \
  --validation-method DNS \
  --region us-east-1
```

2. Validate using DNS records in production account
3. Use the local certificate ARN in your custom domain stack

**Prevention:**
- Always check service-specific requirements before assuming cross-account resources work
- Document which services require same-account resources

### Error: Certificate Validation Timeout

**Symptoms:**
- Certificate stays in "Pending Validation" status
- `aws acm wait certificate-validated` times out

**Root Causes:**
1. DNS validation record not added correctly
2. Nameservers not configured properly
3. DNS propagation delays

**Solution:**
```bash
# 1. Verify validation record requirements
AWS_PROFILE=env-profile aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord'

# 2. Check if record exists in Route53
AWS_PROFILE=prod-profile aws route53 list-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --query "ResourceRecordSets[?Name=='_validation.domain.com.']"

# 3. Force DNS propagation check
dig _validation.domain.com CNAME @8.8.8.8
```

## CloudFormation Errors

### Error: Requires Capabilities

**Full Error:**
```
Embedded stack was not successfully created: Requires capabilities : [CAPABILITY_NAMED_IAM]
```

**Root Cause:**
- Stack creates IAM resources with custom names
- SAM/CloudFormation requires explicit acknowledgment

**Solution:**
```bash
sam deploy \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND CAPABILITY_NAMED_IAM \
  ...
```

**Best Practice:**
- Always use all three capabilities for complex stacks
- Add to samconfig.toml for consistency:
```toml
[default.deploy.parameters]
capabilities = "CAPABILITY_IAM CAPABILITY_AUTO_EXPAND CAPABILITY_NAMED_IAM"
```

### Error: Stack in ROLLBACK_COMPLETE State

**Full Error:**
```
An error occurred (ValidationError) when calling the CreateChangeSet operation: Stack:arn:aws:cloudformation:... is in ROLLBACK_COMPLETE state and can not be updated.
```

**Root Cause:**
- Previous deployment failed and rolled back
- CloudFormation won't update a rolled-back stack

**Solution:**
```bash
# Delete the stack
AWS_PROFILE=profile aws cloudformation delete-stack \
  --stack-name stack-name \
  --region us-east-1

# Wait for deletion
AWS_PROFILE=profile aws cloudformation wait stack-delete-complete \
  --stack-name stack-name \
  --region us-east-1

# Redeploy
sam deploy ...
```

### Error: Stack in ROLLBACK_FAILED State

**Full Error:**
```
Waiter encountered a terminal failure state: For expression "Stacks[].StackStatus" we matched expected path: "ROLLBACK_FAILED"
```

**Root Cause:**
- Resource deletion failed during rollback
- Usually due to dependencies or permissions

**Solution for AppSync Domain:**
```bash
# 1. Manually disassociate API
AWS_PROFILE=profile aws appsync disassociate-api \
  --domain-name domain.name.com

# 2. Delete domain
AWS_PROFILE=profile aws appsync delete-domain-name \
  --domain-name domain.name.com

# 3. Delete stack retaining problematic resources
AWS_PROFILE=profile aws cloudformation delete-stack \
  --stack-name stack-name \
  --retain-resources ResourceName1 ResourceName2
```

## Cross-Account Access Errors

### Error: Not Authorized to Access Resource

**Full Error:**
```
API: route53:GetHostedZone User: arn:aws:iam::741448914938:user/dev-mh is not authorized to access this resource
```

**Root Cause:**
- Environment account trying to directly access production account resources
- Missing cross-account role or permissions

**Solution Architecture:**
1. Create role in production account:
```yaml
AssumeRolePolicyDocument:
  Statement:
    - Effect: Allow
      Principal:
        AWS: 
          - !Sub "arn:aws:iam::${DevAccountId}:root"
      Action: sts:AssumeRole
      Condition:
        StringEquals:
          "sts:ExternalId": "unique-external-id"
```

2. Create Lambda in environment account that assumes role
3. Use Lambda for all cross-account operations

### Error: Invalid Cross-Account Role ARN

**Symptoms:**
- Lambda fails with "AccessDenied" when assuming role
- Role ARN typos or wrong account ID

**Debugging Steps:**
```bash
# 1. Verify role exists in production
AWS_PROFILE=prod aws iam get-role \
  --role-name cross-account-dns-role

# 2. Test assume role manually
AWS_PROFILE=dev aws sts assume-role \
  --role-arn arn:aws:iam::PROD_ACCOUNT:role/role-name \
  --role-session-name test-session \
  --external-id "external-id"

# 3. Check trust policy
AWS_PROFILE=prod aws iam get-role \
  --role-name role-name \
  --query 'Role.AssumeRolePolicyDocument'
```

## Lambda Function Errors

### Error: TTL Parameter Type Mismatch

**Full Error:**
```
Parameter validation failed:
Invalid type for parameter ChangeBatch.Changes[0].ResourceRecordSet.TTL, value: 300, type: <class 'str'>, valid types: <class 'int'>
```

**Root Cause:**
- CloudFormation passes all parameters as strings
- Route53 API requires integer for TTL

**Solution in Lambda:**
```python
# Convert string to int
ttl = int(properties.get('TTL', 300))

# Or more robust
try:
    ttl = int(properties.get('TTL', '300'))
except (ValueError, TypeError):
    ttl = 300  # default
```

### Error: Lambda Timeout During DNS Operations

**Symptoms:**
- Custom resource times out
- Stack stuck in CREATE_IN_PROGRESS

**Root Cause:**
- Default Lambda timeout too short
- Route53 API throttling

**Solution:**
```yaml
CrossAccountDNSFunction:
  Type: AWS::Serverless::Function
  Properties:
    Timeout: 300  # 5 minutes max for custom resources
    ReservedConcurrentExecutions: 1  # Prevent throttling
```

### Error: cfnresponse Not Found

**Full Error:**
```
Unable to import module 'index': No module named 'cfnresponse'
```

**Root Cause:**
- cfnresponse module only available in CloudFormation-invoked Lambdas
- Not available in local testing

**Solution:**
```python
try:
    import cfnresponse
except ImportError:
    # Local testing mock
    class cfnresponse:
        SUCCESS = "SUCCESS"
        FAILED = "FAILED"
        
        @staticmethod
        def send(event, context, status, data, physical_id=None):
            print(f"Mock cfnresponse: {status}")
```

## DNS and Route53 Errors

### Error: Record Already Exists

**Full Error:**
```
InvalidChangeBatch: [RRSet with DNS name domain.com. type CNAME already exists.]
```

**Root Cause:**
- Trying to create duplicate record
- Previous deployment didn't clean up

**Solution:**
```python
# Use UPSERT instead of CREATE
change_batch = {
    'Changes': [{
        'Action': 'UPSERT',  # Not 'CREATE'
        'ResourceRecordSet': {...}
    }]
}
```

### Error: Hosted Zone Not Found

**Symptoms:**
- Route53 operations fail with "No hosted zone found"
- Wrong zone ID or cross-account issues

**Debugging:**
```bash
# List all zones
AWS_PROFILE=prod aws route53 list-hosted-zones \
  --query 'HostedZones[*].[Name,Id]' \
  --output table

# Verify zone ID format
# Correct: Z07794393NL0TD72QHLLD
# Wrong: /hostedzone/Z07794393NL0TD72QHLLD
```

## AppSync Specific Errors

### Error: Domain Already Associated

**Full Error:**
```
Resource of type 'AWS::AppSync::DomainNameApiAssociation' with identifier 'domain.com/ApiAssociation' has a conflict. Reason: Another process is modifying this AWS::AppSync::DomainNameApiAssociation.
```

**Root Cause:**
- Domain already associated with an API
- Race condition during stack operations

**Solution:**
```bash
# 1. Check current association
AWS_PROFILE=env aws appsync get-domain-name \
  --domain-name domain.com

# 2. Disassociate if needed
AWS_PROFILE=env aws appsync disassociate-api \
  --domain-name domain.com

# 3. Wait before re-associating
sleep 30
```

### Error: GraphQL API Not Found

**Symptoms:**
- Custom domain deployment fails
- "API does not exist" errors

**Prevention:**
```bash
# Always verify API exists before custom domain deployment
AWS_PROFILE=env aws appsync get-graphql-api \
  --api-id $API_ID \
  --query 'graphqlApi.name'
```

## S3 and Resource Naming Errors

### Error: S3 Bucket Already Exists

**Full Error:**
```
clkk-mobile-backend-uploads-dev already exists in stack arn:aws:cloudformation:...
```

**Root Cause:**
- S3 bucket names must be globally unique
- Hardcoded bucket names in templates

**Solutions:**

1. **Use --resolve-s3 flag:**
```bash
sam deploy --resolve-s3
```

2. **Generate unique names in template:**
```yaml
FileUploadBucket:
  Type: AWS::S3::Bucket
  Properties:
    BucketName: !Sub "${AWS::StackName}-${AWS::AccountId}-uploads"
```

3. **Use generated names:**
```yaml
FileUploadBucket:
  Type: AWS::S3::Bucket
  # Don't specify BucketName - let CF generate it
```

### Error: DynamoDB Table Already Exists

**Full Error:**
```
Table already exists: clkk-mobile-backend-dev-app-table
```

**Solution:**
```bash
# Check if table exists
AWS_PROFILE=env aws dynamodb describe-table \
  --table-name table-name 2>/dev/null

# Delete if needed
AWS_PROFILE=env aws dynamodb delete-table \
  --table-name table-name

# Use deletion protection in prod
TableName: !If
  - IsProd
  - !Ref AWS::NoValue  # Generated name in prod
  - !Sub "${StackName}-${Environment}-table"
```

## Prevention Best Practices

### 1. Defensive CloudFormation

```yaml
Conditions:
  CreateNewResource: !Not [!Equals [!Ref ExistingResourceId, ""]]

Resources:
  MyResource:
    Type: AWS::Service::Resource
    Condition: CreateNewResource
```

### 2. Robust Error Handling in Lambda

```python
def handler(event, context):
    try:
        # Main logic
        pass
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'ResourceNotFoundException':
            # Handle gracefully
            pass
        else:
            raise
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        cfnresponse.send(event, context, cfnresponse.FAILED, {}, str(e))
```

### 3. Comprehensive Logging

```python
import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    logger.info(f"Event: {json.dumps(event)}")
    # ... rest of function
```

### 4. Idempotent Operations

- Always use UPSERT for DNS records
- Check existence before creation
- Handle "already exists" as success
- Clean up resources in DELETE operations

## Quick Error Resolution Checklist

1. ✅ Check AWS credentials and profile
2. ✅ Verify correct region
3. ✅ Confirm resource exists (API, certificate, etc.)
4. ✅ Check IAM permissions
5. ✅ Look for hardcoded/duplicate resource names
6. ✅ Verify cross-account roles and trust policies
7. ✅ Check CloudFormation capabilities
8. ✅ Review Lambda logs in CloudWatch
9. ✅ Confirm DNS propagation
10. ✅ Validate certificate status

## Getting Help

When errors persist:

1. **Enable debug logging:**
```bash
sam deploy --debug
```

2. **Check CloudFormation events:**
```bash
aws cloudformation describe-stack-events \
  --stack-name stack-name \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'
```

3. **Review Lambda logs:**
```bash
aws logs tail /aws/lambda/function-name --follow
```

4. **Test components individually:**
- Verify certificates separately
- Test Lambda functions locally
- Check DNS resolution independently
- Validate IAM permissions with policy simulator