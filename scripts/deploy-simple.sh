#!/bin/bash

# Simple deployment script for CLKK Backend
# Deploys without custom domain by default

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
ENVIRONMENT="${1:-dev}"
STACK_NAME="clkk-backend"
AWS_REGION="${AWS_REGION:-us-east-1}"

echo -e "${GREEN}Deploying CLKK Backend - $ENVIRONMENT environment${NC}"

# Build
echo -e "${YELLOW}Building application...${NC}"
sam build

# Deploy
echo -e "${YELLOW}Deploying to AWS...${NC}"
sam deploy \
    --stack-name "${STACK_NAME}-${ENVIRONMENT}" \
    --parameter-overrides "Environment=${ENVIRONMENT}" \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset \
    --s3-prefix "$ENVIRONMENT" \
    --region "$AWS_REGION"

echo -e "${GREEN}Deployment complete!${NC}"

# Get outputs
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}-${ENVIRONMENT}-ApiStack" \
    --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiEndpoint`].OutputValue' \
    --output text 2>/dev/null || echo "N/A")

echo -e "${GREEN}API Endpoint: $API_ENDPOINT${NC}"