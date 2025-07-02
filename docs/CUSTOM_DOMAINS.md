# Custom Domain Setup Guide

This guide explains how the CLKK Mobile Backend integrates with the shared CLKK platform domain infrastructure.

## Overview

The mobile backend uses:
- **Shared domain** from the CLKK platform stack
- **Cross-account DNS** management for dev/staging environments
- **AppSync custom domains** with subdomain routing
- **SSM parameters** for configuration sharing

### Domain Structure

The mobile API uses subdomains under the main platform domain:
- **Production**: `mobile-api.clkk.io`
- **Staging**: `mobile-api.staging.clkk.io`
- **Development**: `mobile-api.dev.clkk.io`

## Prerequisites

1. **Platform Stack**: The CLKK platform stack must be deployed with:
   - Domain name in SSM: `/clkk/platform/domain-name`
   - Hosted Zone ID in SSM: `/clkk/platform/hosted-zone-id`
   - Mobile certificate in SSM: `/clkk/platform/certificates/mobile`

2. **Cross-Account DNS Role**: For dev/staging, the production account must have the DNS management role

3. **AWS Permissions**: IAM permissions for AppSync, Lambda, and CloudFormation

## Deployment Process

### Automated Deployment

Use the provided script that handles all stacks:

```bash
# Deploy with shared domain
./scripts/deploy-with-shared-domain.sh staging

# The script will:
# 1. Deploy cross-account DNS function (dev/staging only)
# 2. Deploy main application stack
# 3. Deploy custom domain with DNS records
```

### Manual Step-by-Step

If you prefer to deploy each stack manually:

#### Step 1: Deploy Cross-Account DNS Function (Dev/Staging only)

```bash
# Deploy cross-account DNS function
sam deploy \
    --stack-name clkk-mobile-backend-cross-account-dns-staging \
    --template-file stacks/dns/cross-account-dns.yaml \
    --parameter-overrides \
        "Environment=staging" \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM
```

#### Step 2: Deploy Main Application

```bash
# Build and deploy main stack
sam build --use-container

sam deploy \
    --stack-name clkk-mobile-backend-staging \
    --parameter-overrides \
        "Environment=staging" \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND
```

#### Step 3: Deploy Custom Domain

```bash
# Get GraphQL API ID
GRAPHQL_API_ID=$(aws cloudformation describe-stacks \
    --stack-name clkk-mobile-backend-staging-ApiStack \
    --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiId`].OutputValue' \
    --output text)

# Deploy custom domain stack
sam deploy \
    --stack-name clkk-mobile-backend-custom-domain-staging \
    --template-file stacks/dns/custom-domain-stack.yaml \
    --parameter-overrides \
        "StackName=clkk-mobile-backend" \
        "Environment=staging" \
        "GraphQLApiId=$GRAPHQL_API_ID" \
    --capabilities CAPABILITY_IAM
```

## Deployment Without Custom Domain

For simple deployments without custom domain:

```bash
# Use the simple deployment script
./scripts/deploy-simple.sh staging

# Or use SAM directly
sam build --use-container
sam deploy --stack-name clkk-backend-staging --parameter-overrides "Environment=staging"
```

## Architecture Details

### Cross-Account DNS (`stacks/dns/cross-account-dns.yaml`)
- Lambda function that can assume role in production account
- Manages Route53 records across accounts
- Only needed for dev/staging environments

### Custom Domain Stack (`stacks/dns/custom-domain-stack.yaml`)
- Creates AppSync custom domain
- Associates domain with GraphQL API
- Creates DNS records using cross-account function
- Reads configuration from SSM parameters

### Platform Integration
The mobile backend integrates with the platform infrastructure:
- Uses shared domain from `/clkk/platform/domain-name`
- Uses shared hosted zone from `/clkk/platform/hosted-zone-id`
- Requires certificate in `/clkk/platform/certificates/mobile`

## Certificate Management

Unlike API Gateway which can share certificates, AppSync requires subdomain-specific certificates:
- `mobile-api.clkk.io` for production
- `mobile-api.staging.clkk.io` for staging
- `mobile-api.dev.clkk.io` for development

These should be created in the platform stack and stored in SSM.

## Troubleshooting

### SSM Parameters Not Found
- Ensure platform stack is deployed first
- Check parameter names match exactly
- Verify you're in the correct AWS region

### Cross-Account DNS Issues
- Verify the role exists in production account
- Check trust relationship includes your dev account ID
- Ensure external ID matches: `clkk-dns-management`

### Certificate Not Found
- Mobile certificates must be created separately for AppSync
- Store certificate ARN in `/clkk/platform/certificates/mobile`
- Certificate must match the exact subdomain

### DNS Not Resolving
- Check cross-account DNS function logs
- Verify Route53 record was created in production account
- DNS propagation can take a few minutes

### API Not Accessible
- Check AppSync custom domain status in console
- Verify certificate is valid and matches domain
- Ensure DNS records point to AppSync CloudFront distribution

## Best Practices

1. **Coordinate with platform team** - Ensure certificates are created
2. **Use consistent naming** - Follow the mobile-api subdomain pattern
3. **Test in dev first** - Verify cross-account DNS works
4. **Monitor DNS health** - Check CloudWatch logs for issues
5. **Document dependencies** - Track which platform resources you use

## Manual Verification

After setup, verify your custom domain:

```bash
# Check DNS resolution
nslookup mobile-api.staging.clkk.io

# Test GraphQL endpoint
curl -X POST https://mobile-api.staging.clkk.io/graphql \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  -d '{"query": "{ health }"}'

# Check certificate
openssl s_client -connect mobile-api.staging.clkk.io:443 -servername mobile-api.staging.clkk.io
```

## Cleanup

To remove custom domains:

1. Delete custom domain stack: `aws cloudformation delete-stack --stack-name clkk-mobile-backend-custom-domain-staging`
2. Delete main application stack: `aws cloudformation delete-stack --stack-name clkk-mobile-backend-staging`
3. Delete cross-account DNS: `aws cloudformation delete-stack --stack-name clkk-mobile-backend-cross-account-dns-staging`

## Integration with Other Services

Since we're using `mobile-api` subdomain, other CLKK services can use different subdomains:
- `api.clkk.io` - Main platform API
- `admin.clkk.io` - Admin dashboard
- `mobile-api.clkk.io` - Mobile backend (this project)
- `webhooks.clkk.io` - Webhook handlers