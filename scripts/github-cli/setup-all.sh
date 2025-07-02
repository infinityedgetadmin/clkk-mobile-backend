#!/bin/bash

# Master script to set up all GitHub environments and secrets
# Prerequisites: GitHub CLI (gh) must be installed and authenticated

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${GREEN}=== CLKK Backend GitHub Setup ===${NC}"
echo -e "${YELLOW}This script will set up environments and secrets for your repository${NC}"

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with GitHub CLI${NC}"
    echo "Please run: gh auth login"
    exit 1
fi

# Display repository information
REPO_OWNER=$(gh repo view --json owner -q .owner.login)
REPO_NAME=$(gh repo view --json name -q .name)
echo -e "${GREEN}Repository: ${REPO_OWNER}/${REPO_NAME}${NC}"

# Confirm before proceeding
echo -e "\n${YELLOW}This will create:${NC}"
echo "  - staging environment"
echo "  - production environment (with protection rules)"
echo "  - Repository secrets for dev (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)"
echo "  - Staging environment secrets (STAGING_AWS_ACCESS_KEY_ID, STAGING_AWS_SECRET_ACCESS_KEY)"
echo "  - Production environment secrets (PROD_AWS_ACCESS_KEY_ID, PROD_AWS_SECRET_ACCESS_KEY)"
echo
read -p "Do you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Setup cancelled${NC}"
    exit 0
fi

# Run setup scripts
echo -e "\n${GREEN}Step 1: Setting up environments${NC}"
bash "${SCRIPT_DIR}/setup-environments.sh"

echo -e "\n${GREEN}Step 2: Setting up secrets${NC}"
bash "${SCRIPT_DIR}/setup-secrets.sh"

echo -e "\n${GREEN}=== Setup Complete! ===${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update the placeholder AWS credentials with real values"
echo "2. Add reviewers to the production environment"
echo "3. Test the workflows by pushing to main branch"
echo
echo -e "${GREEN}Repository settings: https://github.com/${REPO_OWNER}/${REPO_NAME}/settings${NC}"