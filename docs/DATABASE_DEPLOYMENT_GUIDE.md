# Database Deployment Guide

## Overview
This guide explains how we handle database deployments to prevent data loss and ensure smooth updates across environments.

## Database Protection Strategies

### 1. Retention Policies
The DynamoDB table has the following protection:
```yaml
DeletionPolicy: Retain
UpdateReplacePolicy: Retain
```
This ensures:
- Table is NOT deleted when stack is deleted
- Table is NOT replaced during stack updates
- Data persists even if CloudFormation stack fails

### 2. Environment-Specific Naming
Tables are named with environment suffix:
- Dev: `clkk-backend-dev-app-table`
- Staging: `clkk-backend-staging-app-table`  
- Production: `clkk-backend-prod-app-table`

This prevents:
- Cross-environment conflicts
- Accidental data mixing
- Deployment collisions

### 3. Point-in-Time Recovery
Production tables have PITR enabled:
```yaml
PointInTimeRecoverySpecification:
  PointInTimeRecoveryEnabled: true
```
Allows restoration to any point within 35 days.

## Handling Existing Tables

### Scenario 1: Table Already Exists
**Problem**: CloudFormation fails if table with same name exists.

**Solution**: 
1. Import existing table into stack:
```bash
aws cloudformation create-change-set \
  --stack-name clkk-backend-dev \
  --change-set-name import-table \
  --change-set-type IMPORT \
  --resources-to-import '[{
    "ResourceType": "AWS::DynamoDB::Table",
    "LogicalResourceId": "ApplicationTable",
    "ResourceIdentifier": {
      "TableName": "clkk-backend-dev-app-table"
    }
  }]' \
  --template-body file://template.yaml
```

2. Or rename the new table by changing stack name or environment.

### Scenario 2: Stack Update Requires Table Replacement
**Problem**: Some changes require table replacement (e.g., changing key schema).

**Solution**: 
1. The `UpdateReplacePolicy: Retain` prevents data loss
2. Manual migration required:
   - Deploy new table with different name
   - Migrate data using DynamoDB Streams or AWS Data Pipeline
   - Update application to use new table
   - Delete old table when safe

### Scenario 3: Failed Deployment Cleanup
**Problem**: Failed deployment leaves orphaned resources.

**Solution**:
```bash
# List tables
aws dynamodb list-tables --query "TableNames[?contains(@, 'clkk-backend')]"

# Describe table to check if in use
aws dynamodb describe-table --table-name TABLE_NAME

# Delete if truly orphaned (BE CAREFUL!)
aws dynamodb delete-table --table-name TABLE_NAME
```

## Best Practices

### 1. Pre-deployment Checks
```bash
# Check if table exists
aws dynamodb describe-table \
  --table-name clkk-backend-dev-app-table \
  2>/dev/null && echo "Table exists" || echo "Table does not exist"
```

### 2. Backup Before Major Changes
```bash
# Create on-demand backup
aws dynamodb create-backup \
  --table-name clkk-backend-prod-app-table \
  --backup-name "pre-deployment-$(date +%Y%m%d-%H%M%S)"
```

### 3. Use Stack Imports for Existing Resources
When deploying to an environment with existing tables:
1. First deployment: Import existing resources
2. Subsequent deployments: Normal updates

### 4. Separate Data Stack
Consider separating database into its own stack:
- Deploy once per environment
- Rarely updated
- Other stacks reference via exports

## Production Deployment Strategy

### 1. Blue-Green Deployment (Recommended)
- Deploy new stack alongside existing
- Migrate traffic gradually
- Keep old stack as fallback

### 2. In-Place Updates
- Use change sets to preview changes
- Ensure no replacement required
- Have rollback plan ready

### 3. Data Migration Pattern
For schema changes:
1. Add new attributes (non-breaking)
2. Deploy code that writes both old and new
3. Backfill existing data
4. Deploy code that reads from new
5. Remove old attributes

## Monitoring and Alerts

### CloudWatch Alarms
- Table throttling
- System errors
- High consumption
- Backup failures

### Deployment Validation
```bash
# Verify table exists and is active
aws dynamodb describe-table \
  --table-name clkk-backend-dev-app-table \
  --query 'Table.TableStatus'

# Check indexes
aws dynamodb describe-table \
  --table-name clkk-backend-dev-app-table \
  --query 'Table.GlobalSecondaryIndexes[*].IndexStatus'
```

## Emergency Procedures

### Data Recovery
1. From PITR (Production only):
```bash
aws dynamodb restore-table-to-point-in-time \
  --source-table-name clkk-backend-prod-app-table \
  --target-table-name clkk-backend-prod-app-table-restore \
  --restore-date-time "2024-01-01T00:00:00Z"
```

2. From backup:
```bash
aws dynamodb restore-table-from-backup \
  --target-table-name clkk-backend-prod-app-table-restore \
  --backup-arn arn:aws:dynamodb:region:account:table/name/backup/name
```

### Rollback Strategy
1. Keep previous CloudFormation template
2. Use change sets for visibility
3. Tag deployments with version
4. Document breaking changes

## Environment-Specific Configurations

### Development
- Deletion allowed for quick iteration
- No backups required
- Can reset data freely

### Staging
- Mirrors production setup
- Regular backups
- Test migrations here first

### Production
- Strict retention policies
- Automated backups
- PITR enabled
- Multi-region consideration