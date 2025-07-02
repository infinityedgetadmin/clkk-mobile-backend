#!/bin/bash

# GitHub CLI script to set up secrets for CLKK Backend
# Prerequisites: GitHub CLI (gh) must be installed and authenticated

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_OWNER=$(gh repo view --json owner -q .owner.login)
REPO_NAME=$(gh repo view --json name -q .name)

echo -e "${GREEN}Setting up GitHub secrets for ${REPO_OWNER}/${REPO_NAME}${NC}"

# Function to create repository secret
create_repo_secret() {
    local secret_name=$1
    local secret_value=$2
    
    echo -e "${YELLOW}Creating repository secret: ${secret_name}${NC}"
    
    gh secret set "${secret_name}" --body "${secret_value}"
    
    echo -e "${GREEN}✓ Repository secret '${secret_name}' created${NC}"
}

# Function to create environment secret
create_env_secret() {
    local env_name=$1
    local secret_name=$2
    local secret_value=$3
    
    echo -e "${YELLOW}Creating environment secret: ${secret_name} for ${env_name}${NC}"
    
    gh secret set "${secret_name}" --env "${env_name}" --body "${secret_value}"
    
    echo -e "${GREEN}✓ Environment secret '${secret_name}' created in '${env_name}'${NC}"
}

# Check if running in interactive mode
if [ -t 0 ]; then
    INTERACTIVE=true
else
    INTERACTIVE=false
fi

# Function to get secret value
get_secret_value() {
    local secret_name=$1
    local default_value=$2
    local secret_value=""
    
    if [ "$INTERACTIVE" = true ]; then
        echo -e "${BLUE}Enter value for ${secret_name} (or press Enter for placeholder):${NC}"
        read -s secret_value
        echo
    fi
    
    if [ -z "$secret_value" ]; then
        secret_value="${default_value}"
        echo -e "${YELLOW}Using placeholder value for ${secret_name}${NC}"
    fi
    
    echo "$secret_value"
}

echo -e "\n${GREEN}=== Setting Repository Secrets (Dev Only) ===${NC}"

# Repository secrets for dev environment only
AWS_ACCESS_KEY_ID=$(get_secret_value "AWS_ACCESS_KEY_ID" "AKIAIOSFODNN7EXAMPLE")
AWS_SECRET_ACCESS_KEY=$(get_secret_value "AWS_SECRET_ACCESS_KEY" "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY")

create_repo_secret "AWS_ACCESS_KEY_ID" "$AWS_ACCESS_KEY_ID"
create_repo_secret "AWS_SECRET_ACCESS_KEY" "$AWS_SECRET_ACCESS_KEY"

echo -e "\n${GREEN}=== Setting Staging Environment Secrets ===${NC}"

# Staging environment secrets
STAGING_AWS_ACCESS_KEY_ID=$(get_secret_value "STAGING_AWS_ACCESS_KEY_ID" "AKIAIOSFODNN7STAGINGEXAMPLE")
STAGING_AWS_SECRET_ACCESS_KEY=$(get_secret_value "STAGING_AWS_SECRET_ACCESS_KEY" "wJalrXUtnFEMI/K7MDENG/bPxRfiCYSTAGINGEXAMPLEKEY")

create_env_secret "staging" "STAGING_AWS_ACCESS_KEY_ID" "$STAGING_AWS_ACCESS_KEY_ID"
create_env_secret "staging" "STAGING_AWS_SECRET_ACCESS_KEY" "$STAGING_AWS_SECRET_ACCESS_KEY"

echo -e "\n${GREEN}=== Setting Production Environment Secrets ===${NC}"

# Production environment secrets
PROD_AWS_ACCESS_KEY_ID=$(get_secret_value "PROD_AWS_ACCESS_KEY_ID" "AKIAIOSFODNN7PRODEXAMPLE")
PROD_AWS_SECRET_ACCESS_KEY=$(get_secret_value "PROD_AWS_SECRET_ACCESS_KEY" "wJalrXUtnFEMI/K7MDENG/bPxRfiCYPRODEXAMPLEKEY")

create_env_secret "production" "PROD_AWS_ACCESS_KEY_ID" "$PROD_AWS_ACCESS_KEY_ID"
create_env_secret "production" "PROD_AWS_SECRET_ACCESS_KEY" "$PROD_AWS_SECRET_ACCESS_KEY"

echo -e "\n${GREEN}✅ All secrets created successfully!${NC}"
echo -e "${YELLOW}Note: Remember to update the placeholder values with real AWS credentials${NC}"
echo -e "${YELLOW}You can update secrets at: https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/secrets/actions${NC}"