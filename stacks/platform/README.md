# CLKK Platform Stack

**Last Updated: January 2, 2025**

This stack manages shared infrastructure resources that are used across all environments. It should only be deployed in the production AWS account.

## Overview

The platform stack creates:
- Route 53 Hosted Zone for the root domain
- SSL certificates for API endpoints in all environments (prod, staging, dev)
- SSL certificates for Mobile GraphQL endpoints in all environments
- SSM parameters for cross-stack references
- Health check endpoint

## Architecture

```
Production Account:
├── Route 53 Hosted Zone (clkk-api.io)
├── SSL Certificates
│   ├── API Certificates:
│   │   ├── Production: api.clkk-api.io
│   │   ├── Staging: api.staging.clkk-api.io
│   │   └── Development: api.dev.clkk-api.io
│   └── Mobile Certificates:
│       ├── Production: mobile.clkk-api.io
│       ├── Staging: mobile.staging.clkk-api.io
│       └── Development: mobile.dev.clkk-api.io
└── SSM Parameters (for cross-stack access)
```

## API Endpoint Strategy

The platform stack supports multiple service endpoints:

### REST API Endpoints (Path-based routing):
- **Production**: `https://api.clkk-api.io`
  - Admin API: `https://api.clkk-api.io/admin`
  - User API: `https://api.clkk-api.io/api`
  - Webhooks: `https://api.clkk-api.io/webhooks`

- **Staging**: `https://api.staging.clkk-api.io`
  - Admin API: `https://api.staging.clkk-api.io/admin`
  - User API: `https://api.staging.clkk-api.io/api`
  - Webhooks: `https://api.staging.clkk-api.io/webhooks`

- **Development**: `https://api.dev.clkk-api.io`
  - Admin API: `https://api.dev.clkk-api.io/admin`
  - User API: `https://api.dev.clkk-api.io/api`
  - Webhooks: `https://api.dev.clkk-api.io/webhooks`

### Mobile GraphQL Endpoints:
- **Production**: `https://mobile.clkk-api.io/graphql`
- **Staging**: `https://mobile.staging.clkk-api.io/graphql`
- **Development**: `https://mobile.dev.clkk-api.io/graphql`

## Deployment

### Prerequisites

1. AWS CLI configured with appropriate credentials
2. SAM CLI installed
3. Domain already purchased (this stack doesn't purchase domains)

### Deploy the Platform Stack

```bash
# Using the deployment script
./deploy-platform.sh --profile clkk-saas-prod --domain clkk-api.io

# Or manually with SAM
AWS_PROFILE=clkk-saas-prod AWS_SDK_LOAD_CONFIG=1 sam deploy \
  --template-file platform-stack.yaml \
  --stack-name clkk-platform-stack \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides Environment=prod DomainName=clkk-api.io \
  --no-confirm-changeset
```

### Post-Deployment Steps

1. **Configure Nameservers**: After deployment, get the Route 53 nameservers from the stack outputs and configure them with your domain registrar.

2. **Verify DNS**: Use `dig` or `nslookup` to verify DNS resolution:
   ```bash
   dig clkk-api.io NS
   ```

3. **Certificate Validation**: The ACM certificates will automatically validate via DNS once the nameservers are configured.

## Using Platform Resources in Other Stacks

Other stacks can reference platform resources using:

### CloudFormation Exports
```yaml
CertificateArn: !ImportValue clkk-platform-stack-prod-cert-arn
```

### SSM Parameters
```yaml
HostedZoneId:
  Type: AWS::SSM::Parameter::Value<String>
  Default: /clkk/platform/hosted-zone-id
```

## Outputs

The stack exports:
- `HostedZoneId`: Route 53 hosted zone ID
- `DomainName`: Root domain name
- API Certificates:
  - `ProductionCertificateArn`: SSL certificate for production API
  - `StagingCertificateArn`: SSL certificate for staging API
  - `DevelopmentCertificateArn`: SSL certificate for development API
- Mobile Certificates:
  - `ProductionMobileCertificateArn`: SSL certificate for production mobile
  - `StagingMobileCertificateArn`: SSL certificate for staging mobile
  - `DevelopmentMobileCertificateArn`: SSL certificate for development mobile

## Important Notes

1. **Production Only**: This stack should only be deployed in the production AWS account
2. **One-Time Setup**: This is typically deployed once and rarely changed
3. **Cross-Environment**: Resources are shared across all environments
4. **Certificate Region**: Certificates are created in the stack's region. For CloudFront, you need certificates in us-east-1