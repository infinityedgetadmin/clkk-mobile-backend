# DNS and Custom Domain Deployment Checklist

**Last Updated: 2025-01-02**

This checklist ensures you don't miss any steps when setting up DNS and custom domains across AWS accounts.

## Pre-Deployment Checklist

### ✅ Account Setup
- [ ] Production AWS account ID: _______________
- [ ] Dev AWS account ID: _______________
- [ ] Staging AWS account ID: _______________
- [ ] Prod AWS account ID: _______________

### ✅ AWS CLI Profiles
- [ ] `aws configure list --profile prod-profile`
- [ ] `aws configure list --profile dev-profile`
- [ ] `aws configure list --profile staging-profile`

### ✅ Domain Information
- [ ] Root domain name: _______________
- [ ] Domain registrar: _______________
- [ ] Subdomain pattern planned (e.g., api.dev.domain.com)

### ✅ Tools Installed
- [ ] AWS CLI v2: `aws --version`
- [ ] SAM CLI: `sam --version`
- [ ] jq: `jq --version`
- [ ] dig: `dig -v`

## Phase 1: Platform Stack (Production Account)

### ✅ Deploy Platform Stack
- [ ] Navigate to platform stack directory
- [ ] Review `platform-stack.yaml` parameters
- [ ] Deploy stack:
  ```bash
  AWS_PROFILE=prod-profile sam deploy \
    --stack-name platform-stack \
    --template-file platform-stack.yaml \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
      Environment=prod \
      DomainName=YOUR_DOMAIN \
    --no-confirm-changeset
  ```
- [ ] Note Hosted Zone ID: _______________
- [ ] Note Nameservers: _______________

### ✅ Configure Domain
- [ ] Log into domain registrar
- [ ] Update nameservers to AWS values
- [ ] Verify with: `dig YOUR_DOMAIN NS`

### ✅ Verify Platform Resources
- [ ] Check Route53 hosted zone created
- [ ] Check certificates created (if any)
- [ ] Check SSM parameters created

## Phase 2: Cross-Account DNS Setup

### ✅ Deploy Cross-Account Role (Production)
- [ ] Navigate to `stacks/dns/roles`
- [ ] Update account IDs in `prod-account-dns-role-mobile.yaml`
- [ ] Deploy role:
  ```bash
  AWS_PROFILE=prod-profile sam deploy \
    --stack-name cross-account-dns-role \
    --template-file prod-account-dns-role-mobile.yaml \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides \
      MobileDevAccountId=DEV_ACCOUNT_ID \
      MobileStagingAccountId=STAGING_ACCOUNT_ID \
    --no-confirm-changeset
  ```
- [ ] Note Role ARN: _______________

### ✅ Deploy DNS Lambda (Each Environment)

For each environment (dev/staging/prod):

- [ ] Deploy Lambda:
  ```bash
  AWS_PROFILE=env-profile sam deploy \
    --stack-name cross-account-dns-ENVIRONMENT \
    --template-file cross-account-dns-resource-mobile.yaml \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides \
      Environment=ENVIRONMENT \
    --no-confirm-changeset
  ```
- [ ] Note Lambda ARN: _______________
- [ ] Test Lambda (optional):
  ```bash
  aws lambda invoke \
    --function-name ENVIRONMENT-clkk-mobile-cross-account-dns \
    --payload '{"test": true}' \
    response.json
  ```

## Phase 3: Application Deployment

### ✅ Pre-Deployment Cleanup
- [ ] Check for existing stacks: `aws cloudformation list-stacks`
- [ ] Delete failed stacks if needed
- [ ] Check for existing DynamoDB tables
- [ ] Check for existing S3 buckets

### ✅ Deploy Application
- [ ] Build application: `sam build`
- [ ] Deploy with all capabilities:
  ```bash
  AWS_PROFILE=env-profile sam deploy \
    --stack-name app-name-ENVIRONMENT \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND CAPABILITY_NAMED_IAM \
    --parameter-overrides Environment=ENVIRONMENT \
    --no-confirm-changeset \
    --resolve-s3
  ```
- [ ] Note API ID (GraphQL): _______________
- [ ] Note API endpoint: _______________

## Phase 4: SSL Certificates

### ✅ Determine Certificate Strategy
- [ ] Service type (AppSync/API Gateway/CloudFront)
- [ ] Same-account requirement? (AppSync: Yes)
- [ ] Certificate domain name planned

### ✅ Request Certificate (If Same-Account Required)
- [ ] Request certificate:
  ```bash
  AWS_PROFILE=env-profile aws acm request-certificate \
    --domain-name subdomain.domain.com \
    --validation-method DNS
  ```
- [ ] Note Certificate ARN: _______________

### ✅ Validate Certificate
- [ ] Get validation CNAME:
  ```bash
  AWS_PROFILE=env-profile aws acm describe-certificate \
    --certificate-arn CERT_ARN \
    --query 'Certificate.DomainValidationOptions[0].ResourceRecord'
  ```
- [ ] Add validation record to Route53 (production account)
- [ ] Wait for validation:
  ```bash
  AWS_PROFILE=env-profile aws acm wait certificate-validated \
    --certificate-arn CERT_ARN
  ```

## Phase 5: Custom Domain Deployment

### ✅ Gather Required Parameters
- [ ] Environment: _______________
- [ ] Root Domain: _______________
- [ ] Hosted Zone ID: _______________
- [ ] Certificate ARN: _______________
- [ ] API ID: _______________
- [ ] DNS Lambda ARN: _______________

### ✅ Deploy Custom Domain
- [ ] Deploy stack:
  ```bash
  AWS_PROFILE=env-profile sam deploy \
    --stack-name app-custom-domain-ENVIRONMENT \
    --template-file custom-domain-with-lambda.yaml \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
      Environment=ENVIRONMENT \
      RootDomain=DOMAIN \
      HostedZoneId=ZONE_ID \
      CertificateArn=CERT_ARN \
      GraphQLApiId=API_ID \
      CrossAccountDnsFunctionArn=LAMBDA_ARN \
    --no-confirm-changeset
  ```
- [ ] Note custom domain: _______________

## Phase 6: Verification

### ✅ DNS Verification
- [ ] Check DNS propagation:
  ```bash
  dig subdomain.domain.com CNAME +short
  ```
- [ ] Verify from multiple locations:
  ```bash
  dig @8.8.8.8 subdomain.domain.com CNAME
  dig @1.1.1.1 subdomain.domain.com CNAME
  ```

### ✅ Endpoint Testing
- [ ] Test HTTPS connectivity:
  ```bash
  curl -I https://subdomain.domain.com/graphql
  ```
- [ ] Test with API key (if applicable):
  ```bash
  curl -X POST https://subdomain.domain.com/graphql \
    -H 'Content-Type: application/json' \
    -H 'x-api-key: API_KEY' \
    -d '{"query": "{ health }"}'
  ```

### ✅ Certificate Verification
- [ ] Check certificate:
  ```bash
  echo | openssl s_client -connect subdomain.domain.com:443 2>/dev/null | openssl x509 -noout -subject -dates
  ```

## Post-Deployment

### ✅ Documentation
- [ ] Update environment documentation
- [ ] Record all ARNs and IDs
- [ ] Update runbooks
- [ ] Share custom domain URL with team

### ✅ Monitoring Setup
- [ ] CloudWatch alarms configured
- [ ] Route53 health checks (if needed)
- [ ] Certificate expiration monitoring

### ✅ Security Review
- [ ] Review IAM roles and permissions
- [ ] Verify least-privilege access
- [ ] Check for exposed endpoints
- [ ] Review CORS settings

## Rollback Plan

If issues occur:

1. **Custom Domain Issues:**
   - [ ] Delete custom domain stack
   - [ ] Manually disassociate domain if needed
   - [ ] Clean up DNS records

2. **Application Issues:**
   - [ ] Revert to previous version
   - [ ] Use direct API endpoint temporarily

3. **Certificate Issues:**
   - [ ] Delete and re-request certificate
   - [ ] Verify DNS validation records

## Common Issues Quick Check

- [ ] Certificate in same account? (AppSync requirement)
- [ ] All CloudFormation capabilities included?
- [ ] Cross-account role trusted by environment account?
- [ ] DNS Lambda has correct role ARN?
- [ ] No hardcoded S3 bucket names?
- [ ] TTL converted to integer in Lambda?
- [ ] External ID matches in role and Lambda?

## Notes Section

_Use this space to record environment-specific details, issues encountered, or special configurations:_

_______________________________________________
_______________________________________________
_______________________________________________
_______________________________________________

## Sign-Off

- Deployed by: _______________
- Date: _______________
- Reviewed by: _______________
- Production approval: _______________