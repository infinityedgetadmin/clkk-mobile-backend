# DNS and Certificate Quick Reference

**Last Updated: 2025-01-02**

## Common Commands

### Certificate Management

```bash
# List all certificates
aws acm list-certificates --region us-east-1

# Get certificate details
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:region:account:certificate/id \
  --region us-east-1

# Find certificates by domain
aws acm list-certificates \
  --query 'CertificateSummaryList[?contains(DomainName, `example.com`)]' \
  --region us-east-1
```

### Route 53 DNS Management

```bash
# List all hosted zones
aws route53 list-hosted-zones

# Get specific hosted zone details
aws route53 get-hosted-zone --id Z1234567890ABC

# List all records in a zone
aws route53 list-resource-record-sets \
  --hosted-zone-id Z1234567890ABC

# Create/Update DNS record
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch file://change-batch.json
```

### SSM Parameter Store

```bash
# Get parameter value
aws ssm get-parameter \
  --name /platform/certificates/prod \
  --query 'Parameter.Value' \
  --output text

# List parameters by prefix
aws ssm describe-parameters \
  --filters "Key=Name,Values=/platform/" \
  --query 'Parameters[*].[Name,Type]' \
  --output table

# Get multiple parameters
aws ssm get-parameters \
  --names /platform/domain-name /platform/hosted-zone-id \
  --query 'Parameters[*].[Name,Value]' \
  --output table
```

### AppSync Custom Domains

```bash
# Create custom domain
aws appsync create-domain-name \
  --domain-name graphql.example.com \
  --certificate-arn arn:aws:acm:region:account:certificate/id

# Associate with API
aws appsync associate-api \
  --domain-name graphql.example.com \
  --api-id abcdefghijklmnop

# Get domain details
aws appsync get-domain-name \
  --domain-name graphql.example.com
```

### API Gateway Custom Domains

```bash
# Create custom domain
aws apigateway create-domain-name \
  --domain-name api.example.com \
  --regional-certificate-arn arn:aws:acm:region:account:certificate/id \
  --endpoint-configuration types=REGIONAL

# Create base path mapping
aws apigateway create-base-path-mapping \
  --domain-name api.example.com \
  --rest-api-id abcdef123456 \
  --stage prod
```

## CloudFormation Snippets

### Custom Resource for DNS

```yaml
DnsRecord:
  Type: Custom::DnsRecord
  Properties:
    ServiceToken: !GetAtt DnsManagerFunction.Arn
    RecordName: !Sub "api.${DomainName}"
    RecordType: CNAME
    RecordValue: !GetAtt ApiDomainName.RegionalDomainName
    TTL: 300
```

### Cross-Stack Certificate Reference

```yaml
# Using Export
CertificateArn: !ImportValue platform-stack-prod-cert-arn

# Using SSM Parameter
CertificateArn:
  Type: AWS::SSM::Parameter::Value<String>
  Default: /platform/certificates/prod
```

### Conditional Domain Names

```yaml
DomainName: !If
  - IsProd
  - !Sub "api.${RootDomain}"
  - !Sub "api.${Environment}.${RootDomain}"
```

## DNS Record Examples

### CNAME Record (for APIs)
```json
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "api.example.com",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{
        "Value": "d-1234567890.execute-api.us-east-1.amazonaws.com"
      }]
    }
  }]
}
```

### A Record with Alias (for CloudFront)
```json
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "www.example.com",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "Z2FDTNDATAQYW2",
        "DNSName": "d1234567890.cloudfront.net",
        "EvaluateTargetHealth": false
      }
    }
  }]
}
```

## Debugging

### Check DNS Resolution
```bash
# Using dig
dig api.example.com
dig @8.8.8.8 api.example.com  # Use Google DNS

# Using nslookup
nslookup api.example.com
nslookup api.example.com 8.8.8.8

# Check specific record type
dig api.example.com CNAME
```

### Certificate Validation Status
```bash
# Check validation details
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --query 'Certificate.DomainValidationOptions[*].[DomainName,ValidationStatus]' \
  --output table
```

### CloudFormation Stack Issues
```bash
# Get stack events
aws cloudformation describe-stack-events \
  --stack-name my-stack \
  --query 'StackEvents[0:10].[Timestamp,ResourceStatus,ResourceStatusReason]' \
  --output table

# Get failed resources
aws cloudformation describe-stack-resources \
  --stack-name my-stack \
  --query 'StackResources[?ResourceStatus==`CREATE_FAILED`]'
```

## Common Issues

### Certificate Not Validating
1. Check nameservers are correct
2. Verify DNS validation CNAME exists
3. Wait up to 30 minutes
4. Check Route 53 has authority

### Custom Domain 403 Error
1. DNS propagation (wait 5-10 min)
2. Certificate doesn't match domain
3. Base path mapping incorrect
4. API stage doesn't exist

### Cross-Account Access Denied
1. Trust relationship incorrect
2. Role ARN typo
3. Missing permissions
4. Wrong region

## Environment Variables

```bash
# For scripts
export PLATFORM_STACK_NAME="platform-stack"
export DOMAIN_NAME="example.com"
export AWS_REGION="us-east-1"
export PRODUCTION_ACCOUNT_ID="111111111111"

# For different environments
case $ENVIRONMENT in
  prod)
    DOMAIN_PREFIX=""
    ;;
  staging)
    DOMAIN_PREFIX="staging."
    ;;
  dev)
    DOMAIN_PREFIX="dev."
    ;;
esac
```

## Makefile Targets

```makefile
# Common DNS operations
.PHONY: list-certs check-dns validate-cert

list-certs:
	aws acm list-certificates --region $(AWS_REGION) --output table

check-dns:
	@echo "Checking DNS for $(DOMAIN_NAME)..."
	@dig $(DOMAIN_NAME) +short
	@dig _acme-challenge.$(DOMAIN_NAME) CNAME +short

validate-cert:
	aws acm describe-certificate \
		--certificate-arn $(CERT_ARN) \
		--query 'Certificate.Status' \
		--output text
```