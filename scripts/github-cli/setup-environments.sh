#!/bin/bash

# GitHub CLI script to set up environments for CLKK Backend
# Prerequisites: GitHub CLI (gh) must be installed and authenticated

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
REPO_OWNER=$(gh repo view --json owner -q .owner.login)
REPO_NAME=$(gh repo view --json name -q .name)

echo -e "${GREEN}Setting up GitHub environments for ${REPO_OWNER}/${REPO_NAME}${NC}"

# Function to create environment
create_environment() {
    local env_name=$1
    local protection_rules=$2
    
    echo -e "${YELLOW}Creating environment: ${env_name}${NC}"
    
    # Create environment using GitHub API
    gh api \
        --method PUT \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "/repos/${REPO_OWNER}/${REPO_NAME}/environments/${env_name}" \
        --input - <<EOF
{
    "wait_timer": 0,
    "prevent_self_review": false,
    "reviewers": [],
    "deployment_branch_policy": null
}
EOF
    
    echo -e "${GREEN}✓ Environment '${env_name}' created${NC}"
}

# Function to update environment protection rules
update_environment_protection() {
    local env_name=$1
    local wait_timer=$2
    local prevent_self_review=$3
    local protected_branches=$4
    
    echo -e "${YELLOW}Updating protection rules for: ${env_name}${NC}"
    
    # Update environment protection using GitHub API
    gh api \
        --method PUT \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "/repos/${REPO_OWNER}/${REPO_NAME}/environments/${env_name}" \
        --input - <<EOF
{
    "wait_timer": ${wait_timer},
    "prevent_self_review": ${prevent_self_review},
    "reviewers": [],
    "deployment_branch_policy": {
        "protected_branches": ${protected_branches},
        "custom_branch_policies": false
    }
}
EOF
    
    echo -e "${GREEN}✓ Protection rules updated for '${env_name}'${NC}"
}

# Create staging environment
echo -e "\n${GREEN}=== Creating Staging Environment ===${NC}"
create_environment "staging"

# Create production environment with protection
echo -e "\n${GREEN}=== Creating Production Environment ===${NC}"
create_environment "production"

# Update production environment with protection rules
echo -e "\n${GREEN}=== Configuring Production Protection ===${NC}"
update_environment_protection "production" 5 true true

echo -e "\n${GREEN}✅ All environments created successfully!${NC}"
echo -e "${YELLOW}Note: You may need to manually add reviewers to the production environment${NC}"
echo -e "${YELLOW}Go to: https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/environments${NC}"