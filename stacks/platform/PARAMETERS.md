# Platform Stack Parameters

**Last Updated: January 2, 2025**

The platform stack creates the following SSM parameters that can be used by other stacks:

## Hosted Zone
- `/clkk/platform/hosted-zone-id` - Route 53 Hosted Zone ID

## Domain Name
- `/clkk/platform/domain-name` - Root domain name (e.g., clkk-api.com)

## API Certificates
- `/clkk/platform/certificates/prod` - Production API certificate ARN (api.clkk-api.com)
- `/clkk/platform/certificates/staging` - Staging API certificate ARN (api.staging.clkk-api.com)
- `/clkk/platform/certificates/dev` - Development API certificate ARN (api.dev.clkk-api.com)

## Mobile Certificates
- `/clkk/platform/certificates/mobile/prod` - Production mobile certificate ARN (mobile.clkk-api.com)
- `/clkk/platform/certificates/mobile/staging` - Staging mobile certificate ARN (mobile.staging.clkk-api.com)
- `/clkk/platform/certificates/mobile/dev` - Development mobile certificate ARN (mobile.dev.clkk-api.com)

## Usage in Other Stacks

### Using CloudFormation Exports:
```yaml
# API Certificate
ApiCertificateArn: !ImportValue clkk-platform-stack-prod-cert-arn
# Mobile Certificate
MobileCertificateArn: !ImportValue clkk-platform-stack-prod-mobile-cert-arn
# Hosted Zone
HostedZoneId: !ImportValue clkk-platform-stack-hosted-zone-id
```

### Using SSM Parameters:
```yaml
Parameters:
  HostedZoneId:
    Type: AWS::SSM::Parameter::Value<String>
    Default: /clkk/platform/hosted-zone-id
    
  ApiCertificateArn:
    Type: AWS::SSM::Parameter::Value<String>
    Default: /clkk/platform/certificates/prod
    
  MobileCertificateArn:
    Type: AWS::SSM::Parameter::Value<String>
    Default: /clkk/platform/certificates/mobile/prod
```

## Environment-Specific Domains

### API Endpoints:
- Production: https://api.clkk-api.com
- Staging: https://api.staging.clkk-api.com
- Development: https://api.dev.clkk-api.com

### Mobile GraphQL Endpoints:
- Production: https://mobile.clkk-api.com/graphql
- Staging: https://mobile.staging.clkk-api.com/graphql
- Development: https://mobile.dev.clkk-api.com/graphql