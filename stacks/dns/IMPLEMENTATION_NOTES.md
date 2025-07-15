# DNS Implementation Notes - CLKK Mobile Backend

**Last Updated: 2025-01-02**

This document captures the specific implementation details of how we set up DNS and certificates for the CLKK mobile backend project.

## What We Built

We implemented a multi-account DNS architecture where:
- **Platform Stack** (in production account) manages all DNS and certificates
- **Mobile Backend** (can be in any account) uses GraphQL with custom domains
- **Cross-account access** allows services to create DNS records

## Implementation Timeline

### 1. Platform Stack Updates

We updated the existing platform stack to add mobile certificates:

```yaml
# Added to platform-stack.yaml:
# Production Mobile Certificate (covers mobile.clkk-api.io)
ProductionMobileCertificate:
  Type: AWS::CertificateManager::Certificate
  Properties:
    DomainName: !Sub "mobile.${DomainName}"
    ValidationMethod: DNS
    # ... (similar for staging and dev)
```

**Key Changes**:
- Added 3 new certificates: `mobile.clkk-api.io`, `mobile.staging.clkk-api.io`, `mobile.dev.clkk-api.io`
- Created SSM parameters for each certificate
- Updated outputs to include mobile endpoints

### 2. Deployment Command

```bash
AWS_PROFILE=clkk-saas-prod sam deploy \
  --stack-name clkk-platform-stack \
  --template-file stacks/platform/platform-stack.yaml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    Environment=prod \
    DomainName=clkk-api.io \
  --no-confirm-changeset \
  --region us-east-1
```

### 3. Verification Steps

```bash
# List mobile certificates
AWS_PROFILE=clkk-saas-prod aws acm list-certificates \
  --region us-east-1 \
  --query 'CertificateSummaryList[?contains(DomainName, `mobile`)]'

# Check SSM parameters
AWS_PROFILE=clkk-saas-prod aws ssm get-parameters \
  --names \
    /clkk/platform/certificates/mobile/prod \
    /clkk/platform/certificates/mobile/staging \
    /clkk/platform/certificates/mobile/dev \
  --region us-east-1
```

## Architecture Decisions

### Why We Kept Everything in Production Account

1. **Simplicity**: No cross-account complexity for this phase
2. **Cost**: Single hosted zone instead of one per environment
3. **Security**: Centralized certificate management
4. **Existing Pattern**: Platform stack was already in production

### Domain Structure

We chose subdomain-based environment separation:
- **Production**: `mobile.clkk-api.io`
- **Staging**: `mobile.staging.clkk-api.io`
- **Development**: `mobile.dev.clkk-api.io`

This pattern:
- Clearly identifies environments
- Allows wildcard certificates if needed
- Follows industry standards
- Works well with AppSync (no path-based routing)

### Certificate Strategy

We created individual certificates rather than wildcards because:
- AppSync requires exact domain match
- More granular control
- Can revoke per environment
- Clearer audit trail

## Files Modified

### `/stacks/platform/platform-stack.yaml`
- Added mobile certificate resources (lines 94-146)
- Added SSM parameters for mobile certs (lines 213-250)
- Added mobile certificate outputs (lines 305-322)
- Updated ApiEndpoints output to include mobile

### `/stacks/platform/README.md`
- Updated with today's date
- Changed all `.com` references to `.io`
- Added mobile certificates to architecture diagram
- Added mobile endpoints to API strategy section

### `/stacks/platform/PARAMETERS.md`
- Updated with today's date  
- Added mobile certificate SSM parameters
- Updated usage examples
- Added mobile GraphQL endpoints

## Results

After deployment:
- ✅ 3 SSL certificates issued (ISSUED status)
- ✅ SSM parameters created with certificate ARNs
- ✅ Stack outputs updated
- ✅ No impact on existing resources

## Next Steps

To use these certificates for the mobile GraphQL API:

1. **Deploy Mobile Backend** with AppSync
2. **Create Custom Domain** using the certificate
3. **Set up DNS Records** pointing to AppSync domain
4. **Test Endpoints** after DNS propagation

Example endpoint after setup:
```
https://mobile.clkk-api.io/graphql
```

## Lessons Learned

1. **Domain Consistency**: Initially had `.com` in docs but `.io` in deployment - always verify
2. **Certificate Validation**: DNS validation is automatic with Route 53 hosted zone
3. **No Downtime**: Adding resources to existing stack causes no disruption
4. **SSM Parameters**: Great for cross-stack references without tight coupling

## Troubleshooting Tips

If certificates don't validate:
```bash
# Check DNS validation records
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --query 'Certificate.DomainValidationOptions'
```

If SSM parameters not found:
```bash
# List all parameters
aws ssm describe-parameters \
  --query 'Parameters[?contains(Name, `mobile`)]'
```

## Cost Implications

- **Certificates**: Free in ACM
- **Route 53**: $0.50/month per hosted zone (already exists)
- **SSM Parameters**: Free for standard tier
- **DNS Queries**: $0.40 per million queries

Total additional cost: ~$0 (using existing infrastructure)