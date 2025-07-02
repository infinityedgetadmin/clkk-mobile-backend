# GitHub Environments Setup Guide

This guide will help you set up the GitHub environments required for the CI/CD workflows.

## Required Environments

You need to create two environments in your GitHub repository:
1. `staging`
2. `production`

## Steps to Create Environments

1. Go to your repository on GitHub
2. Click on **Settings** → **Environments**
3. Click **New environment**
4. Create each environment with the following settings:

### Staging Environment
- **Name**: `staging`
- **Environment URL**: (optional) Your staging API endpoint
- **Deployment protection rules**:
  - Required reviewers: Optional (you can add reviewers if needed)
  - Deployment branches: All branches
- **Environment secrets**:
  - `STAGING_AWS_ACCESS_KEY_ID`
  - `STAGING_AWS_SECRET_ACCESS_KEY`

### Production Environment
- **Name**: `production`
- **Environment URL**: (optional) Your production API endpoint
- **Deployment protection rules**:
  - ✅ Required reviewers: Add yourself and/or team members
  - ✅ Prevent self-review
  - Deployment branches: Protected branches only (main)
  - Wait timer: 5 minutes (optional)
- **Environment secrets**:
  - `PROD_AWS_ACCESS_KEY_ID`
  - `PROD_AWS_SECRET_ACCESS_KEY`

## Required Repository Secrets

Go to **Settings** → **Secrets and variables** → **Actions** and add:

### Repository Secrets (for Dev Only)
- `AWS_ACCESS_KEY_ID`: AWS access key for dev deployments only
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for dev deployments only

### Environment Secrets (for Staging)
These are added to the `staging` environment specifically:
- `STAGING_AWS_ACCESS_KEY_ID`: AWS access key for staging
- `STAGING_AWS_SECRET_ACCESS_KEY`: AWS secret key for staging

### Environment Secrets (for Production)
These are added to the `production` environment specifically:
- `PROD_AWS_ACCESS_KEY_ID`: AWS access key for production
- `PROD_AWS_SECRET_ACCESS_KEY`: AWS secret key for production

## AWS IAM Permissions

Create three IAM users with programmatic access:

### Dev IAM User
Attach these policies for development environment:
- `AWSCloudFormationFullAccess`
- `IAMFullAccess` (or a custom policy for creating Lambda execution roles)
- `AmazonS3FullAccess` (or specific bucket access)
- `AWSLambda_FullAccess`
- `AmazonDynamoDBFullAccess`
- `AmazonAPIGatewayAdministrator`
- `CloudWatchLogsFullAccess`

### Staging IAM User
Same permissions as Dev but for staging resources.

### Production IAM User
Same permissions but for production resources. Consider using more restrictive policies.

## Verification

After setup, you can verify:
1. Push to main branch → Should deploy to dev
2. Create a tag `v1.0.0` → Should deploy to staging, then wait for production approval
3. Approve production deployment → Should deploy to production

## Security Best Practices

1. **Rotate credentials regularly**
2. **Use least-privilege IAM policies**
3. **Enable MFA for production approvers**
4. **Review deployment logs regularly**
5. **Use different AWS accounts for each environment** (recommended):
   - Separate AWS account for dev
   - Separate AWS account for staging
   - Separate AWS account for production