# GitHub Actions Workflows

This directory contains GitHub Actions workflows for CI/CD automation of the CLKK Backend V3.

## Workflows

### 1. Deploy to Development (`deploy-dev.yml`)
- **Triggers**: Push to `main` or `develop` branches
- **Purpose**: Automatically deploy changes to the development environment
- **Features**:
  - Builds with Node.js 20.x container image
  - Runs tests and linting (currently non-blocking)
  - Deploys using AWS SAM CLI
  - Shows deployment outputs including API endpoint

### 2. Deploy to Staging and Production (`deploy-staging-prod.yml`)
- **Triggers**: 
  - Push tags matching `v*` pattern
  - Manual workflow dispatch
- **Purpose**: Deploy to staging and production with approval gates
- **Features**:
  - Deploys to staging first
  - Requires environment approval for production
  - Uses separate AWS credentials for each environment

### 3. Deploy with Custom Domain (`deploy-custom-domain.yml`)
- **Triggers**: Manual workflow dispatch only
- **Purpose**: Deploy complete stack with custom domain (certificate, app, DNS)
- **Features**:
  - Deploys certificate stack
  - Deploys main application with custom domain
  - Configures DNS records
  - All-in-one deployment script

### 4. Pull Request Checks (`pr-checks.yml`)
- **Triggers**: Pull requests to `main` or `develop`
- **Purpose**: Validate code quality before merge
- **Features**:
  - Code formatting checks
  - ESLint validation
  - Test execution
  - SAM template validation
  - Security vulnerability scanning

## Required GitHub Secrets

### Repository Secrets (For Development Only)
Add these in Settings → Secrets and variables → Actions → Repository secrets:
- `AWS_ACCESS_KEY_ID`: AWS access key for dev environment only
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for dev environment only

### Environment Secrets (For Staging)
Add these in Settings → Environments → staging → Environment secrets:
- `STAGING_AWS_ACCESS_KEY_ID`: AWS access key for staging deployments
- `STAGING_AWS_SECRET_ACCESS_KEY`: AWS secret key for staging deployments

### Environment Secrets (For Production)
Add these in Settings → Environments → production → Environment secrets:
- `PROD_AWS_ACCESS_KEY_ID`: AWS access key for production deployments
- `PROD_AWS_SECRET_ACCESS_KEY`: AWS secret key for production deployments

Note: The warnings about "Context access might be invalid" will disappear once you add these secrets to your repository.

## Environment Protection Rules

### Staging Environment
- No approval required
- Runs after successful PR merge

### Production Environment
- Requires manual approval
- Only specific users/teams can approve
- Deployment logs are retained

## AWS IAM Permissions Required

The AWS credentials need the following permissions:
- CloudFormation stack operations
- S3 bucket access (for SAM artifacts)
- Lambda function management
- API Gateway/AppSync management
- DynamoDB table access
- IAM role creation (for Lambda execution roles)
- CloudWatch logs access

## Usage

### Deploy to Development
Simply push to `main` or `develop` branch:
```bash
git push origin main
```

### Deploy to Staging/Production
Create and push a version tag:
```bash
git tag v1.0.0
git push origin v1.0.0
```

### Manual Deployment
Go to Actions tab → Select workflow → Run workflow

## Customization

### Using Different Node.js Versions
Update the `NODE_VERSION` environment variable in the workflows.

### Using Different AWS Regions
Update the `AWS_REGION` environment variable in the workflows.

### Adding New Environments
1. Copy an existing workflow
2. Update environment-specific variables
3. Add required secrets
4. Configure environment protection rules in GitHub settings