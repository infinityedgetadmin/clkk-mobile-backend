# DNS and Custom Domain Best Practices

**Last Updated: 2025-01-02**

This document outlines best practices learned from implementing multi-account DNS and custom domain management.

## Architecture Best Practices

### 1. Centralized DNS Management

**Do:**
- ✅ Keep all DNS records in production account
- ✅ Use cross-account roles for DNS management
- ✅ Implement least-privilege access
- ✅ Use SSM parameters for cross-stack references

**Don't:**
- ❌ Create Route53 zones in multiple accounts
- ❌ Hardcode DNS zone IDs
- ❌ Give broad Route53 permissions
- ❌ Share AWS credentials between accounts

### 2. Certificate Management Strategy

**AppSync Requirements:**
```yaml
# AppSync REQUIRES certificate in same account
AppSyncDomain:
  Type: AWS::AppSync::DomainName
  Properties:
    CertificateArn: !Ref LocalCertificate  # Must be same account
```

**API Gateway Options:**
```yaml
# API Gateway can use cross-account certificates
ApiDomain:
  Type: AWS::ApiGateway::DomainName
  Properties:
    RegionalCertificateArn: !Ref CertificateArn  # Can be cross-account
```

**Best Practice Decision Tree:**
```
Is it AppSync?
├─ YES → Create certificate in each environment account
└─ NO → Is it CloudFront?
    ├─ YES → Certificate must be in us-east-1
    └─ NO → Create in production account (centralized)
```

### 3. Resource Naming Conventions

**Recommended Pattern:**
```yaml
Resources:
  # Stack names
  StackName: ${ServiceName}-${Component}-${Environment}
  # Example: clkk-mobile-backend-api-dev

  # Resource names (let CloudFormation generate when possible)
  S3Bucket:
    Type: AWS::S3::Bucket
    # Don't specify BucketName - let CF generate unique name

  # When you must specify names
  DynamoDBTable:
    Properties:
      TableName: !Sub "${AWS::StackName}-${AWS::AccountId}-table"
```

## Implementation Best Practices

### 1. Cross-Account Role Setup

**Production Account Role:**
```yaml
CrossAccountDNSRole:
  Type: AWS::IAM::Role
  Properties:
    AssumeRolePolicyDocument:
      Statement:
        - Effect: Allow
          Principal:
            AWS: 
              - !Sub "arn:aws:iam::${DevAccountId}:root"
          Action: sts:AssumeRole
          Condition:
            StringEquals:
              "sts:ExternalId": !Ref ExternalId  # Always use ExternalId
    Policies:
      - PolicyName: Route53Access
        PolicyDocument:
          Statement:
            - Effect: Allow
              Action:
                - route53:ChangeResourceRecordSets
                - route53:GetChange
              Resource:
                - !Sub "arn:aws:route53:::hostedzone/${HostedZoneId}"
                - "arn:aws:route53:::change/*"
            - Effect: Allow
              Action:
                - route53:GetHostedZone
                - route53:ListResourceRecordSets
              Resource: !Sub "arn:aws:route53:::hostedzone/${HostedZoneId}"
```

### 2. Lambda Function Best Practices

**Error Handling:**
```python
import json
import boto3
import cfnresponse
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    try:
        logger.info(f"Event: {json.dumps(event)}")
        request_type = event['RequestType']
        
        # Always handle all request types
        if request_type == 'Delete':
            # Clean up resources
            handle_delete(event, context)
        else:  # Create or Update
            handle_upsert(event, context)
            
        cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
        
    except Exception as e:
        logger.error(f"Error: {str(e)}", exc_info=True)
        cfnresponse.send(event, context, cfnresponse.FAILED, {}, str(e))
```

**Type Conversion:**
```python
# CloudFormation passes all parameters as strings
def get_ttl(properties):
    """Safely get TTL as integer."""
    try:
        return int(properties.get('TTL', '300'))
    except (ValueError, TypeError):
        return 300  # default

def get_boolean(value):
    """Convert CloudFormation boolean strings."""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ('true', 'yes', '1')
    return False
```

### 3. DNS Record Management

**Always Use UPSERT:**
```python
change_batch = {
    'Changes': [{
        'Action': 'UPSERT',  # Not 'CREATE' - handles existing records
        'ResourceRecordSet': {
            'Name': record_name,
            'Type': record_type,
            'TTL': ttl,
            'ResourceRecords': [{'Value': record_value}]
        }
    }]
}
```

**Check Before Delete:**
```python
def record_exists(route53, hosted_zone_id, record_name, record_type):
    """Check if record exists before trying to delete."""
    try:
        response = route53.list_resource_record_sets(
            HostedZoneId=hosted_zone_id,
            StartRecordName=record_name,
            StartRecordType=record_type,
            MaxItems='1'
        )
        
        for record in response.get('ResourceRecordSets', []):
            # Normalize names (Route53 adds trailing dot)
            if (record['Name'].rstrip('.') == record_name.rstrip('.') and 
                record['Type'] == record_type):
                return True
        return False
    except Exception:
        return False  # Assume doesn't exist on error
```

## Deployment Best Practices

### 1. SAM Deployment Flags

**Always Use:**
```bash
sam deploy \
  --resolve-s3 \  # Avoid S3 bucket conflicts
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND CAPABILITY_NAMED_IAM \
  --no-confirm-changeset \  # For automation
  --no-fail-on-empty-changeset  # For updates
```

**For Debugging:**
```bash
sam deploy \
  --debug \  # Verbose output
  --disable-rollback  # Keep failed resources for debugging
```

### 2. Parameter Management

**Use SSM for Cross-Stack References:**
```yaml
# In platform stack (producer)
DomainParameter:
  Type: AWS::SSM::Parameter
  Properties:
    Name: /platform/domain-name
    Value: !Ref DomainName
    Type: String
    Tier: Standard

# In application stack (consumer)
Parameters:
  DomainName:
    Type: AWS::SSM::Parameter::Value<String>
    Default: /platform/domain-name
```

**Environment-Specific Parameters:**
```yaml
# Use mappings for environment-specific values
Mappings:
  EnvironmentMap:
    dev:
      subdomain: dev
      certificateParam: /platform/certificates/dev
    staging:
      subdomain: staging
      certificateParam: /platform/certificates/staging
    prod:
      subdomain: ''  # No prefix for prod
      certificateParam: /platform/certificates/prod
```

### 3. Testing Strategy

**Progressive Deployment:**
1. Deploy to dev first
2. Run automated tests
3. Deploy to staging
4. Run integration tests
5. Deploy to production with canary

**Smoke Tests:**
```bash
#!/bin/bash
# smoke-test.sh

DOMAIN=$1
EXPECTED_STATUS=${2:-200}

# Test DNS resolution
echo "Testing DNS resolution..."
if ! dig +short $DOMAIN > /dev/null; then
    echo "DNS resolution failed"
    exit 1
fi

# Test HTTPS
echo "Testing HTTPS..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/health)
if [ "$STATUS" != "$EXPECTED_STATUS" ]; then
    echo "HTTPS test failed. Got: $STATUS, Expected: $EXPECTED_STATUS"
    exit 1
fi

echo "All tests passed!"
```

## Security Best Practices

### 1. IAM Permissions

**Least Privilege for Lambda:**
```yaml
LambdaRole:
  Type: AWS::IAM::Role
  Properties:
    Policies:
      - PolicyName: AssumeSpecificRole
        PolicyDocument:
          Statement:
            - Effect: Allow
              Action: sts:AssumeRole
              Resource: !Sub "arn:aws:iam::${ProductionAccount}:role/specific-role"
              Condition:
                StringEquals:
                  "sts:ExternalId": !Ref ExternalId
```

**Time-Limited Credentials:**
```python
# In Lambda function
def get_route53_client():
    """Get Route53 client with temporary credentials."""
    sts = boto3.client('sts')
    
    assumed_role = sts.assume_role(
        RoleArn=os.environ['PROD_ROLE_ARN'],
        RoleSessionName=f'DNS-{context.request_id}',
        ExternalId=os.environ['EXTERNAL_ID'],
        DurationSeconds=900  # 15 minutes max
    )
    
    return boto3.client(
        'route53',
        aws_access_key_id=assumed_role['Credentials']['AccessKeyId'],
        aws_secret_access_key=assumed_role['Credentials']['SecretAccessKey'],
        aws_session_token=assumed_role['Credentials']['SessionToken']
    )
```

### 2. Secrets Management

**Never Hardcode:**
```yaml
# Bad
Environment:
  Variables:
    API_KEY: "hardcoded-key"  # ❌

# Good
Environment:
  Variables:
    API_KEY_PARAM: !Ref ApiKeyParameter  # ✅

# In Lambda
api_key = boto3.client('ssm').get_parameter(
    Name=os.environ['API_KEY_PARAM'],
    WithDecryption=True
)['Parameter']['Value']
```

### 3. Audit and Compliance

**Enable CloudTrail for DNS Changes:**
```yaml
DNSChangesTopic:
  Type: AWS::SNS::Topic
  Properties:
    Subscription:
      - Endpoint: security-team@company.com
        Protocol: email

DNSChangesRule:
  Type: AWS::Events::Rule
  Properties:
    EventPattern:
      source:
        - aws.route53
      detail-type:
        - AWS API Call via CloudTrail
      detail:
        eventName:
          - ChangeResourceRecordSets
    Targets:
      - Arn: !Ref DNSChangesTopic
```

## Monitoring Best Practices

### 1. CloudWatch Alarms

```yaml
DNSQueryAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    MetricName: DNSQueries
    Namespace: AWS/Route53
    Statistic: Sum
    Period: 300
    EvaluationPeriods: 2
    Threshold: 10000  # Adjust based on traffic
    ComparisonOperator: GreaterThanThreshold

CertificateExpiryAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    MetricName: DaysToExpiry
    Namespace: AWS/CertificateManager
    Dimensions:
      - Name: CertificateArn
        Value: !Ref Certificate
    Statistic: Minimum
    Period: 86400  # Daily
    Threshold: 30  # Alert 30 days before expiry
```

### 2. Custom Metrics

```python
# In Lambda function
cloudwatch = boto3.client('cloudwatch')

def put_metric(name, value, unit='Count'):
    """Send custom metric to CloudWatch."""
    cloudwatch.put_metric_data(
        Namespace='DNSManager',
        MetricData=[{
            'MetricName': name,
            'Value': value,
            'Unit': unit,
            'Dimensions': [
                {
                    'Name': 'Environment',
                    'Value': os.environ.get('ENVIRONMENT', 'unknown')
                }
            ]
        }]
    )

# Usage
put_metric('DNSRecordCreated', 1)
put_metric('DNSOperationDuration', duration, 'Milliseconds')
```

## Cost Optimization

### 1. Route53 Costs

- **Hosted Zones**: $0.50/month each
- **Queries**: $0.40 per million
- **Health Checks**: $0.50-$2.00/month each

**Optimization:**
- Use single hosted zone for all environments
- Implement caching where possible
- Avoid unnecessary health checks

### 2. Certificate Costs

- **ACM Certificates**: Free for AWS resources
- **Validation**: No cost for DNS validation

**Optimization:**
- Use wildcard certificates where appropriate
- Automate renewal process
- Clean up unused certificates

### 3. Lambda Costs

**Optimize Execution:**
```python
# Cache clients outside handler
route53_client = None

def handler(event, context):
    global route53_client
    
    if route53_client is None:
        route53_client = get_route53_client()
    
    # Use cached client
```

## Documentation Standards

### 1. README Template

Every DNS-related stack should include:

```markdown
# Stack Name

## Overview
Brief description of what this stack does

## Architecture
Diagram or description of components

## Prerequisites
- Required AWS services
- Required permissions
- Dependencies

## Deployment
Step-by-step deployment instructions

## Parameters
Table of all parameters with descriptions

## Outputs
Table of all outputs with descriptions

## Troubleshooting
Common issues and solutions

## Maintenance
Regular maintenance tasks
```

### 2. Inline Documentation

```yaml
# Every complex resource should have a comment
CrossAccountDNSRole:
  Type: AWS::IAM::Role
  Properties:
    # This role allows dev/staging accounts to manage DNS records
    # in the production account's hosted zone. It uses ExternalId
    # for additional security and limits permissions to specific
    # Route53 operations on a single hosted zone.
    RoleName: !Sub "${AWS::StackName}-dns-role"
```

### 3. Change Log

Maintain a CHANGELOG.md:

```markdown
# Changelog

## [2025-01-02] - Updated
### Added
- Mobile certificate support
- Cross-account DNS Lambda function

### Changed
- Updated TTL handling to convert strings to integers
- Improved error messages in Lambda function

### Fixed
- Certificate validation in correct account
- DNS record cleanup on stack deletion
```

## Conclusion

Following these best practices will help you:
- 🚀 Deploy faster with fewer errors
- 🔒 Maintain security across accounts
- 💰 Optimize costs
- 📊 Monitor effectively
- 🔧 Troubleshoot efficiently

Remember: The best practice is the one that works reliably in your environment while maintaining security and cost-effectiveness.