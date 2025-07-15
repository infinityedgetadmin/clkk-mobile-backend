# DNS and Custom Domain Troubleshooting Flowchart

**Last Updated: 2025-01-02**

Follow this flowchart when encountering issues with DNS or custom domain setup.

## Start Here

```
Is your deployment failing?
├─ YES → Go to [Deployment Failures](#deployment-failures)
└─ NO → Is your custom domain not working?
    ├─ YES → Go to [Custom Domain Issues](#custom-domain-issues)
    └─ NO → Is it a certificate issue?
        ├─ YES → Go to [Certificate Issues](#certificate-issues)
        └─ NO → Go to [Other Issues](#other-issues)
```

## Deployment Failures

```
What error are you seeing?
├─ "Requires capabilities" → [Fix: Add Capabilities](#fix-add-capabilities)
├─ "Stack in ROLLBACK_COMPLETE" → [Fix: Delete and Redeploy](#fix-delete-and-redeploy)
├─ "Resource already exists" → [Fix: Resource Conflicts](#fix-resource-conflicts)
├─ "Not authorized" → [Fix: Cross-Account Access](#fix-cross-account-access)
├─ "Invalid template" → [Fix: Template Syntax](#fix-template-syntax)
└─ Other → Check CloudFormation events:
    └─ `aws cloudformation describe-stack-events --stack-name NAME`
```

### Fix: Add Capabilities

```bash
# Add all three capabilities
sam deploy \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND CAPABILITY_NAMED_IAM \
  ...
```

### Fix: Delete and Redeploy

```bash
# 1. Delete the stack
aws cloudformation delete-stack --stack-name STACK_NAME

# 2. Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name STACK_NAME

# 3. Redeploy
sam deploy ...
```

### Fix: Resource Conflicts

```
What resource is conflicting?
├─ S3 Bucket → Use --resolve-s3 flag
├─ DynamoDB Table → Delete table: aws dynamodb delete-table --table-name NAME
├─ Lambda Function → Delete function: aws lambda delete-function --function-name NAME
└─ IAM Role → Delete role: aws iam delete-role --role-name NAME
```

### Fix: Cross-Account Access

```
1. Verify cross-account role exists:
   aws iam get-role --role-name ROLE_NAME

2. Check trust policy includes your account:
   aws iam get-role --role-name ROLE_NAME \
     --query 'Role.AssumeRolePolicyDocument'

3. Test assume role:
   aws sts assume-role \
     --role-arn arn:aws:iam::ACCOUNT:role/ROLE \
     --role-session-name test
```

## Custom Domain Issues

```
Can you access the domain?
├─ NO → [DNS Resolution Issues](#dns-resolution-issues)
└─ YES → What response do you get?
    ├─ 403 Forbidden → [Fix: API Association](#fix-api-association)
    ├─ 404 Not Found → [Fix: Base Path Mapping](#fix-base-path-mapping)
    ├─ SSL Error → [Fix: Certificate Issues](#fix-certificate-issues)
    └─ Timeout → [Fix: DNS Propagation](#fix-dns-propagation)
```

### DNS Resolution Issues

```bash
# 1. Check if DNS record exists
dig your.domain.com CNAME

# 2. Check specific nameserver
dig @8.8.8.8 your.domain.com CNAME

# 3. Check Route53 record
aws route53 list-resource-record-sets \
  --hosted-zone-id ZONE_ID \
  --query "ResourceRecordSets[?Name=='your.domain.com.']"

# 4. If no record, check Lambda logs
aws logs tail /aws/lambda/dns-function-name --follow
```

### Fix: API Association

```bash
# For AppSync
aws appsync get-domain-name --domain-name your.domain.com

# Check association
aws appsync list-domain-names \
  --query "domainNameConfigs[?domainName=='your.domain.com']"

# Re-associate if needed
aws appsync associate-api \
  --domain-name your.domain.com \
  --api-id API_ID
```

### Fix: DNS Propagation

```bash
# Wait up to 48 hours for full propagation
# Check from multiple locations:

# Google DNS
dig @8.8.8.8 your.domain.com

# Cloudflare DNS
dig @1.1.1.1 your.domain.com

# Your ISP DNS
dig your.domain.com
```

## Certificate Issues

```
What's the certificate status?
├─ PENDING_VALIDATION → [Fix: DNS Validation](#fix-dns-validation)
├─ FAILED → [Fix: Reissue Certificate](#fix-reissue-certificate)
├─ EXPIRED → [Fix: Renew Certificate](#fix-renew-certificate)
└─ ISSUED but not working → [Fix: Wrong Region/Account](#fix-wrong-region-account)
```

### Fix: DNS Validation

```bash
# 1. Get validation record
aws acm describe-certificate \
  --certificate-arn ARN \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord'

# 2. Add to Route53
cat > validation.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "_abc123.your.domain.com",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{
        "Value": "_def456.acm-validations.aws."
      }]
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id ZONE_ID \
  --change-batch file://validation.json

# 3. Wait for validation
aws acm wait certificate-validated --certificate-arn ARN
```

### Fix: Wrong Region/Account

```
For AppSync:
├─ Certificate MUST be in same account
└─ Certificate MUST be in same region

For API Gateway:
├─ Regional: Certificate in same region
└─ Edge: Certificate must be in us-east-1

For CloudFront:
└─ Certificate MUST be in us-east-1
```

## Lambda Function Issues

```
Is the Lambda function failing?
├─ YES → Check CloudWatch logs:
│   └─ aws logs tail /aws/lambda/FUNCTION_NAME --follow
└─ NO → Is it a permission issue?
    ├─ YES → [Fix: Lambda Permissions](#fix-lambda-permissions)
    └─ NO → [Fix: Lambda Code](#fix-lambda-code)
```

### Fix: Lambda Permissions

```bash
# 1. Check execution role
aws lambda get-function \
  --function-name FUNCTION_NAME \
  --query 'Configuration.Role'

# 2. Check role policies
aws iam list-attached-role-policies \
  --role-name ROLE_NAME

# 3. Add assume role permission if missing
aws iam attach-role-policy \
  --role-name ROLE_NAME \
  --policy-arn POLICY_ARN
```

### Fix: Lambda Code

Common code issues:

1. **TTL Type Error**
   ```python
   # Wrong
   ttl = properties.get('TTL', 300)
   
   # Correct
   ttl = int(properties.get('TTL', 300))
   ```

2. **Missing error handling**
   ```python
   try:
       # your code
   except Exception as e:
       print(f"Error: {str(e)}")
       cfnresponse.send(event, context, cfnresponse.FAILED, {})
   ```

## Quick Diagnosis Commands

```bash
# Stack status
aws cloudformation describe-stacks \
  --stack-name STACK_NAME \
  --query 'Stacks[0].StackStatus'

# Recent errors
aws cloudformation describe-stack-events \
  --stack-name STACK_NAME \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`].[LogicalResourceId,ResourceStatusReason]' \
  --output table

# Certificate status
aws acm describe-certificate \
  --certificate-arn ARN \
  --query 'Certificate.Status'

# DNS record check
dig your.domain.com CNAME +short

# API association (AppSync)
aws appsync get-domain-name \
  --domain-name your.domain.com \
  --query 'domainNameConfig.appsyncDomainName'

# Lambda logs (last 5 minutes)
aws logs tail /aws/lambda/FUNCTION_NAME --since 5m
```

## Emergency Rollback

If all else fails:

1. **Document the issue**
   ```bash
   # Save stack events
   aws cloudformation describe-stack-events \
     --stack-name STACK > stack-events.json
   
   # Save Lambda logs
   aws logs filter-log-events \
     --log-group-name /aws/lambda/FUNCTION > lambda-logs.json
   ```

2. **Clean up resources**
   ```bash
   # Delete custom domain stack
   aws cloudformation delete-stack --stack-name custom-domain-stack
   
   # Disassociate domain (AppSync)
   aws appsync disassociate-api --domain-name domain.com
   
   # Delete domain
   aws appsync delete-domain-name --domain-name domain.com
   ```

3. **Use direct endpoints**
   - AppSync: `https://API_ID.appsync-api.region.amazonaws.com/graphql`
   - API Gateway: `https://API_ID.execute-api.region.amazonaws.com/stage`

4. **File issue with details**
   - Stack events
   - Lambda logs
   - Error messages
   - Steps to reproduce

## Still Stuck?

1. Enable debug mode:
   ```bash
   export SAM_CLI_TELEMETRY=0
   sam deploy --debug
   ```

2. Check service health:
   - https://status.aws.amazon.com/

3. Review quotas:
   ```bash
   # Route53 quotas
   aws service-quotas list-service-quotas \
     --service-code route53
   
   # ACM quotas  
   aws service-quotas list-service-quotas \
     --service-code acm
   ```

4. Contact AWS Support with:
   - Request ID from error messages
   - CloudFormation stack ID
   - Detailed timeline of actions taken