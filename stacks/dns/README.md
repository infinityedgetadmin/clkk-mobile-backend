# DNS and Custom Domain Documentation Hub

**Last Updated: 2025-01-02**

Welcome to the comprehensive documentation for multi-account DNS and custom domain management in AWS. This documentation suite covers everything from initial setup to troubleshooting complex issues.

## 📚 Documentation Overview

### Getting Started

1. **[COMPLETE_DNS_SETUP_GUIDE.md](./COMPLETE_DNS_SETUP_GUIDE.md)** ⭐ **Start Here**
   - Step-by-step implementation guide
   - Based on real deployment experience
   - Includes all commands and configurations
   - Common errors and their solutions

2. **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** ✅
   - Printable checklist for deployments
   - Ensures nothing is missed
   - Includes verification steps
   - Space for environment-specific notes

### Reference Guides

3. **[AWS_MULTI_ACCOUNT_DNS_GUIDE.md](./AWS_MULTI_ACCOUNT_DNS_GUIDE.md)** 🏗️
   - Generic architectural guide
   - Can be used for any AWS project
   - Explains the why behind the architecture
   - Industry best practices

4. **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** ⚡
   - Common commands at your fingertips
   - CloudFormation snippets
   - Quick debugging commands
   - Cheat sheet format

### Troubleshooting

5. **[ERROR_SOLUTIONS.md](./ERROR_SOLUTIONS.md)** 🔧
   - Comprehensive error catalog
   - Detailed solutions for each error
   - Prevention strategies
   - Based on actual errors encountered

6. **[TROUBLESHOOTING_FLOWCHART.md](./TROUBLESHOOTING_FLOWCHART.md)** 🗺️
   - Visual troubleshooting guide
   - Decision trees for problem solving
   - Quick diagnosis commands
   - Emergency rollback procedures

### Best Practices & Notes

7. **[BEST_PRACTICES.md](./BEST_PRACTICES.md)** 💡
   - Architectural best practices
   - Security recommendations
   - Cost optimization tips
   - Monitoring strategies

8. **[IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md)** 📝
   - Specific notes from our implementation
   - Lessons learned
   - Architecture decisions explained
   - Project-specific details

## 🏛️ Architecture Overview

```
Production Account (Centralized DNS)
├── Platform Stack
│   ├── Route53 Hosted Zone
│   ├── SSL Certificates (Platform)
│   └── SSM Parameters
├── Cross-Account DNS Role
└── DNS Records (all environments)

Environment Accounts (Dev/Staging/Prod)
├── Application Stack
│   ├── API (GraphQL/REST)
│   ├── Compute (Lambda/ECS)
│   └── Storage (DynamoDB/S3)
├── Cross-Account DNS Lambda
├── Local SSL Certificates (for AppSync)
└── Custom Domain Stack
```

## 🚀 Quick Start

### For New Implementations

1. Read [COMPLETE_DNS_SETUP_GUIDE.md](./COMPLETE_DNS_SETUP_GUIDE.md)
2. Use [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) during deployment
3. Reference [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for commands
4. When errors occur, check [ERROR_SOLUTIONS.md](./ERROR_SOLUTIONS.md)

### For Existing Implementations

1. Having issues? Start with [TROUBLESHOOTING_FLOWCHART.md](./TROUBLESHOOTING_FLOWCHART.md)
2. Review [BEST_PRACTICES.md](./BEST_PRACTICES.md) for optimizations
3. Check [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md) for project history

## 📁 Stack Templates

### Platform Stack (Production Account)
- [`../platform/platform-stack.yaml`](../platform/platform-stack.yaml) - Main platform infrastructure
- [`../platform/README.md`](../platform/README.md) - Platform documentation
- [`../platform/PARAMETERS.md`](../platform/PARAMETERS.md) - SSM parameter reference

### DNS Management Stacks
- [`roles/prod-account-dns-role-mobile.yaml`](./roles/prod-account-dns-role-mobile.yaml) - Cross-account role for production
- [`roles/cross-account-dns-resource-mobile.yaml`](./roles/cross-account-dns-resource-mobile.yaml) - Lambda for DNS management
- [`custom-domain-with-lambda.yaml`](./custom-domain-with-lambda.yaml) - Custom domain setup with Lambda
- [`custom-domain-simple.yaml`](./custom-domain-simple.yaml) - Simple custom domain (same account)

## 🔑 Key Concepts

### Multi-Account Strategy
- **Production Account**: Owns all DNS and shared certificates
- **Environment Accounts**: Own applications and environment-specific resources
- **Cross-Account Access**: Managed through IAM roles and Lambda functions

### Certificate Requirements
- **AppSync**: Requires certificates in the same account ⚠️
- **API Gateway**: Can use cross-account certificates
- **CloudFront**: Requires certificates in us-east-1

### DNS Management
- **Centralized**: All DNS records in production Route53
- **Automated**: Lambda functions handle record creation/updates
- **Secure**: Cross-account roles with least privilege

## 🛠️ Common Operations

### Deploy Platform Stack (One Time)
```bash
cd ../platform
AWS_PROFILE=prod sam deploy \
  --stack-name platform-stack \
  --template-file platform-stack.yaml \
  --capabilities CAPABILITY_IAM
```

### Deploy Application with Custom Domain
```bash
# 1. Deploy app
AWS_PROFILE=env sam deploy \
  --stack-name app-name \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND CAPABILITY_NAMED_IAM

# 2. Deploy custom domain
AWS_PROFILE=env sam deploy \
  --stack-name app-custom-domain \
  --template-file custom-domain-with-lambda.yaml \
  --capabilities CAPABILITY_IAM
```

### Verify DNS
```bash
# Check DNS resolution
dig subdomain.domain.com CNAME +short

# Test endpoint
curl -I https://subdomain.domain.com/health
```

## 📊 Monitoring

### What to Monitor
- Certificate expiration (30-day warning)
- DNS query volumes (cost optimization)
- Lambda execution errors (DNS management)
- Custom domain health checks

### Where to Look
- **CloudWatch Logs**: `/aws/lambda/*-cross-account-dns`
- **CloudFormation Events**: Stack deployment issues
- **Route53 Metrics**: Query counts and health checks
- **ACM Console**: Certificate status and expiration

## 🚨 Emergency Contacts

### When Things Go Wrong
1. Check [ERROR_SOLUTIONS.md](./ERROR_SOLUTIONS.md) first
2. Follow [TROUBLESHOOTING_FLOWCHART.md](./TROUBLESHOOTING_FLOWCHART.md)
3. Review CloudFormation events and Lambda logs
4. Check AWS Service Health Dashboard

### Rollback Procedure
1. Delete custom domain stack
2. Manually clean up resources if needed
3. Use direct API endpoints temporarily
4. Document issue for post-mortem

## 📈 Future Improvements

### Planned Enhancements
- [ ] Automated certificate renewal notifications
- [ ] Terraform versions of all templates
- [ ] Cost allocation tags for all resources
- [ ] Automated testing for DNS changes
- [ ] Multi-region failover support

### Contributing
When updating this documentation:
1. Update the "Last Updated" date
2. Add your changes to relevant documents
3. Update this index if adding new documents
4. Test all commands and code snippets
5. Include real error messages and solutions

## 📜 License & Credits

This documentation was created through hands-on implementation experience. Special thanks to the AWS documentation team and the broader DevOps community for best practices and patterns.

---

**Remember**: Good documentation is never finished, only improved. If you encounter issues not covered here, please document them for the next person!