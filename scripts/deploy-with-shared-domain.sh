#!/bin/bash

# Deploy CLKK Mobile Backend with Shared Domain
# This script assumes the platform stack has already set up certificates and domain

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="${1:-dev}"
AWS_REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="clkk-mobile-backend"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_step() {
    echo -e "\n${BLUE}===> $1${NC}\n"
}

# Function to validate inputs
validate_inputs() {
    case $ENVIRONMENT in
        dev|staging|prod)
            ;;
        *)
            print_error "Invalid environment: $ENVIRONMENT"
            print_error "Valid environments: dev, staging, prod"
            exit 1
            ;;
    esac
}

# Function to check prerequisites
check_prerequisites() {
    print_step "Checking Prerequisites"
    
    # Check if platform parameters exist
    print_status "Checking platform parameters..."
    
    local domain_param="/clkk/platform/domain-name"
    local zone_param="/clkk/platform/hosted-zone-id"
    local cert_param="/clkk/platform/certificates/mobile"
    
    # Try to get parameters
    DOMAIN_NAME=$(aws ssm get-parameter --name "$domain_param" --query 'Parameter.Value' --output text 2>/dev/null || echo "")
    HOSTED_ZONE_ID=$(aws ssm get-parameter --name "$zone_param" --query 'Parameter.Value' --output text 2>/dev/null || echo "")
    CERTIFICATE_ARN=$(aws ssm get-parameter --name "$cert_param" --query 'Parameter.Value' --output text 2>/dev/null || echo "")
    
    if [ -z "$DOMAIN_NAME" ] || [ -z "$HOSTED_ZONE_ID" ]; then
        print_error "Platform parameters not found. Please ensure the platform stack is deployed."
        print_error "Missing parameters: $domain_param or $zone_param"
        exit 1
    fi
    
    if [ -z "$CERTIFICATE_ARN" ]; then
        print_warning "Mobile certificate not found in SSM. Will need to create it."
    fi
    
    print_status "Domain: $DOMAIN_NAME"
    print_status "Hosted Zone: $HOSTED_ZONE_ID"
    print_status "Certificate: ${CERTIFICATE_ARN:-Not found}"
}

# Step 1: Deploy Cross-Account DNS Function (for dev/staging only)
deploy_cross_account_dns() {
    if [ "$ENVIRONMENT" != "prod" ]; then
        print_step "Step 1: Deploying Cross-Account DNS Function"
        
        sam deploy \
            --stack-name "${STACK_NAME}-cross-account-dns-${ENVIRONMENT}" \
            --template-file stacks/dns/cross-account-dns.yaml \
            --parameter-overrides \
                "Environment=${ENVIRONMENT}" \
            --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
            --no-fail-on-empty-changeset \
            --region "$AWS_REGION"
        
        print_status "Cross-account DNS function deployed"
    else
        print_step "Step 1: Skipping Cross-Account DNS (production environment)"
    fi
}

# Step 2: Deploy Main Application Stack
deploy_main_stack() {
    print_step "Step 2: Deploying Main Application Stack"
    
    print_status "Building application..."
    sam build --use-container
    
    print_status "Deploying to AWS..."
    sam deploy \
        --stack-name "${STACK_NAME}-${ENVIRONMENT}" \
        --parameter-overrides \
            "Environment=${ENVIRONMENT}" \
        --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
        --no-confirm-changeset \
        --no-fail-on-empty-changeset \
        --s3-prefix "$ENVIRONMENT" \
        --region "$AWS_REGION"
    
    # Get GraphQL API ID
    GRAPHQL_API_ID=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}-${ENVIRONMENT}-ApiStack" \
        --query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiId`].OutputValue' \
        --output text)
    
    print_status "GraphQL API ID: $GRAPHQL_API_ID"
}

# Step 3: Deploy Custom Domain Stack
deploy_custom_domain() {
    print_step "Step 3: Deploying Custom Domain"
    
    # Check if certificate exists, if not, we need to create it manually
    if [ -z "$CERTIFICATE_ARN" ]; then
        print_error "Certificate for mobile subdomain not found."
        print_error "Please create a certificate for:"
        
        case $ENVIRONMENT in
            prod)
                print_error "  mobile-api.$DOMAIN_NAME"
                ;;
            staging)
                print_error "  mobile-api.staging.$DOMAIN_NAME"
                ;;
            dev)
                print_error "  mobile-api.dev.$DOMAIN_NAME"
                ;;
        esac
        
        print_error "And store the ARN in SSM parameter: /clkk/platform/certificates/mobile"
        exit 1
    fi
    
    print_status "Deploying custom domain stack..."
    sam deploy \
        --stack-name "${STACK_NAME}-custom-domain-${ENVIRONMENT}" \
        --template-file stacks/dns/custom-domain-stack.yaml \
        --parameter-overrides \
            "StackName=${STACK_NAME}" \
            "Environment=${ENVIRONMENT}" \
            "GraphQLApiId=${GRAPHQL_API_ID}" \
        --capabilities CAPABILITY_IAM \
        --no-fail-on-empty-changeset \
        --region "$AWS_REGION"
    
    # Get the custom domain endpoint
    CUSTOM_DOMAIN=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}-custom-domain-${ENVIRONMENT}" \
        --query 'Stacks[0].Outputs[?OutputKey==`GraphQLEndpoint`].OutputValue' \
        --output text)
    
    print_status "Custom domain endpoint: $CUSTOM_DOMAIN"
}

# Main execution
main() {
    print_status "CLKK Mobile Backend Deployment with Shared Domain"
    print_status "Environment: $ENVIRONMENT"
    
    validate_inputs
    check_prerequisites
    
    # Deploy in order
    deploy_cross_account_dns
    deploy_main_stack
    deploy_custom_domain
    
    # Print summary
    print_step "Deployment Complete!"
    
    case $ENVIRONMENT in
        prod)
            local endpoint="https://mobile-api.${DOMAIN_NAME}/graphql"
            ;;
        staging)
            local endpoint="https://mobile-api.staging.${DOMAIN_NAME}/graphql"
            ;;
        dev)
            local endpoint="https://mobile-api.dev.${DOMAIN_NAME}/graphql"
            ;;
    esac
    
    print_status "Your Mobile API is available at: $endpoint"
    print_warning "DNS propagation may take a few minutes"
    
    echo
    print_status "To test your endpoint:"
    echo "curl -X POST $endpoint \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -H 'x-api-key: YOUR_API_KEY' \\"
    echo "  -d '{\"query\": \"{ health }\"}'"
}

# Run main function
main