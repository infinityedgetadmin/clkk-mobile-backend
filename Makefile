# CLKK Backend V3 Makefile
# AWS SAM with TypeScript and Lambda Powertools

# Variables
STACK_NAME ?= clkk-backend
ENVIRONMENT ?= dev
AWS_REGION ?= us-east-1
SAM_CONFIG_ENV ?= $(ENVIRONMENT)

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

.PHONY: help install generate-types build test deploy-dev deploy-staging deploy-prod clean

help: ## Show this help message
	@echo '${GREEN}CLKK Backend V3 - Available commands:${NC}'
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make ${YELLOW}<target>${NC}\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  ${YELLOW}%-20s${NC} %s\n", $$1, $$2 } /^##@/ { printf "\n${GREEN}%s${NC}\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Dependencies

install: ## Install all dependencies
	@echo "${GREEN}Installing dependencies...${NC}"
	npm install
	@$(MAKE) install-powertools
	@$(MAKE) install-services
	@$(MAKE) install-layers

install-powertools: ## Install AWS Lambda Powertools
	@echo "${GREEN}Installing AWS Lambda Powertools...${NC}"
	cd layers/powertools/nodejs && npm init -y && npm install \
		@aws-lambda-powertools/logger \
		@aws-lambda-powertools/tracer \
		@aws-lambda-powertools/metrics \
		@aws-lambda-powertools/parameters \
		@aws-lambda-powertools/commons \
		@aws-lambda-powertools/idempotency \
		@aws-lambda-powertools/batch \
		@types/aws-lambda \
		middy \
		@middy/core

install-services: ## Install service dependencies
	@echo "${GREEN}Installing service dependencies...${NC}"
	@for service in services/*/; do \
		if [ -f "$$service/package.json" ]; then \
			echo "Installing dependencies for $$service"; \
			cd "$$service" && npm install && cd -; \
		fi \
	done

install-layers: ## Install layer dependencies
	@echo "${GREEN}Installing layer dependencies...${NC}"
	cd layers/common/nodejs && npm init -y && npm install \
		@aws-sdk/client-dynamodb \
		@aws-sdk/lib-dynamodb \
		uuid \
		zod
	cd layers/graphql-types/nodejs && npm init -y

##@ Code Generation

generate-types: ## Generate TypeScript types from GraphQL schema
	@echo "${GREEN}Generating GraphQL types...${NC}"
	@if [ -f "graphql/schema.graphql" ]; then \
		npm run codegen; \
	else \
		echo "${YELLOW}Warning: GraphQL schema not found${NC}"; \
	fi

##@ Build

build: generate-types ## Build the SAM application
	@echo "${GREEN}Building SAM application...${NC}"
	sam build --beta-features --cached --parallel

build-typescript: ## Build TypeScript files
	@echo "${GREEN}Building TypeScript files...${NC}"
	@for service in services/*/; do \
		if [ -f "$$service/tsconfig.json" ]; then \
			echo "Building $$service"; \
			cd "$$service" && npx tsc && cd -; \
		fi \
	done

build-layers: install-powertools ## Build Lambda layers
	@echo "${GREEN}Building Lambda layers...${NC}"
	cd layers/powertools && npm run build 2>/dev/null || echo "Build script not found, skipping..."
	cd layers/common && npm run build 2>/dev/null || echo "Build script not found, skipping..."
	cd layers/graphql-types && npm run build 2>/dev/null || echo "Build script not found, skipping..."

##@ Testing

test: ## Run all tests
	@echo "${GREEN}Running tests...${NC}"
	npm test

test-unit: ## Run unit tests
	@echo "${GREEN}Running unit tests...${NC}"
	npm run test:unit

test-integration: ## Run integration tests
	@echo "${GREEN}Running integration tests...${NC}"
	npm run test:integration

lint: ## Run linting
	@echo "${GREEN}Running linter...${NC}"
	npm run lint

##@ Local Development

local-api: build ## Start local API with hot reload
	@echo "${GREEN}Starting local API with hot reload...${NC}"
	sam local start-api \
		--env-vars env.json \
		--parameter-overrides "Environment=local" \
		--warm-containers EAGER \
		--debug

local-invoke: build ## Invoke a specific function locally
	@echo "${GREEN}Invoking function locally...${NC}"
	@read -p "Enter function name: " FUNCTION_NAME; \
	sam local invoke $$FUNCTION_NAME \
		--env-vars env.json \
		--parameter-overrides "Environment=local"

sync-dev: ## Sync changes to AWS (development)
	@echo "${GREEN}Syncing to AWS development environment...${NC}"
	sam sync --stack-name $(STACK_NAME)-dev \
		--watch \
		--beta-features \
		--parameter-overrides "Environment=dev"

##@ Deployment

validate: ## Validate SAM template
	@echo "${GREEN}Validating SAM template...${NC}"
	sam validate --beta-features

deploy: validate build test ## Deploy to specified environment
	@echo "${GREEN}Deploying to $(ENVIRONMENT) environment...${NC}"
	sam deploy \
		--stack-name $(STACK_NAME)-$(ENVIRONMENT) \
		--parameter-overrides "Environment=$(ENVIRONMENT)" \
		--config-env $(SAM_CONFIG_ENV) \
		--no-fail-on-empty-changeset

deploy-dev: ## Deploy to development environment
	@$(MAKE) deploy ENVIRONMENT=dev

deploy-staging: ## Deploy to staging environment
	@$(MAKE) deploy ENVIRONMENT=staging

deploy-prod: ## Deploy to production environment with confirmation
	@echo "${RED}WARNING: You are about to deploy to PRODUCTION!${NC}"
	@read -p "Are you sure? (y/N): " CONFIRM; \
	if [ "$$CONFIRM" = "y" ] || [ "$$CONFIRM" = "Y" ]; then \
		$(MAKE) deploy ENVIRONMENT=prod; \
	else \
		echo "${YELLOW}Deployment cancelled${NC}"; \
	fi

##@ Stack Management

describe-stack: ## Describe the CloudFormation stack
	@echo "${GREEN}Describing stack $(STACK_NAME)-$(ENVIRONMENT)...${NC}"
	aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME)-$(ENVIRONMENT) \
		--region $(AWS_REGION) \
		--query 'Stacks[0]' \
		--output table

list-outputs: ## List stack outputs
	@echo "${GREEN}Stack outputs for $(STACK_NAME)-$(ENVIRONMENT):${NC}"
	aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME)-$(ENVIRONMENT) \
		--region $(AWS_REGION) \
		--query 'Stacks[0].Outputs' \
		--output table

##@ Monitoring

logs: ## Tail CloudWatch logs for a function
	@echo "${GREEN}Available functions:${NC}"
	@aws logs describe-log-groups \
		--log-group-name-prefix /aws/lambda/$(STACK_NAME)-$(ENVIRONMENT) \
		--query 'logGroups[].logGroupName' \
		--output text | tr '\t' '\n'
	@read -p "Enter function name to tail logs: " FUNCTION_NAME; \
	sam logs -n $$FUNCTION_NAME --stack-name $(STACK_NAME)-$(ENVIRONMENT) --tail

metrics: ## View CloudWatch metrics dashboard
	@echo "${GREEN}Opening CloudWatch metrics dashboard...${NC}"
	@echo "Dashboard URL: https://console.aws.amazon.com/cloudwatch/home?region=$(AWS_REGION)#dashboards:name=$(STACK_NAME)-$(ENVIRONMENT)-powertools"

traces: ## View X-Ray traces
	@echo "${GREEN}Opening X-Ray traces...${NC}"
	@echo "X-Ray URL: https://console.aws.amazon.com/xray/home?region=$(AWS_REGION)#/service-map"

##@ Utilities

clean: ## Clean build artifacts
	@echo "${GREEN}Cleaning build artifacts...${NC}"
	rm -rf .aws-sam
	rm -rf node_modules
	rm -rf services/*/node_modules
	rm -rf layers/*/nodejs/node_modules
	rm -rf **/*.js **/*.d.ts **/*.js.map
	find . -name "*.pyc" -delete
	find . -name "__pycache__" -delete

reset: clean ## Reset project (clean + remove dependencies)
	@echo "${RED}Resetting project...${NC}"
	rm -rf package-lock.json
	rm -rf services/*/package-lock.json
	rm -rf layers/*/nodejs/package-lock.json

format: ## Format code
	@echo "${GREEN}Formatting code...${NC}"
	npm run format

update-deps: ## Update all dependencies
	@echo "${GREEN}Updating dependencies...${NC}"
	npm update
	@for service in services/*/; do \
		if [ -f "$$service/package.json" ]; then \
			echo "Updating dependencies for $$service"; \
			cd "$$service" && npm update && cd -; \
		fi \
	done

##@ GraphQL

graphql-playground: ## Open GraphQL playground
	@echo "${GREEN}GraphQL endpoints:${NC}"
	@aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME)-$(ENVIRONMENT) \
		--query 'Stacks[0].Outputs[?OutputKey==`GraphQLApiEndpoint`].OutputValue' \
		--output text

generate-schema-docs: ## Generate GraphQL schema documentation
	@echo "${GREEN}Generating GraphQL schema documentation...${NC}"
	@if [ -f "graphql/schema.graphql" ]; then \
		npx graphql-markdown graphql/schema.graphql > docs/graphql-schema.md; \
		echo "Documentation generated at docs/graphql-schema.md"; \
	else \
		echo "${RED}Error: GraphQL schema not found${NC}"; \
	fi

##@ Security

scan-deps: ## Scan dependencies for vulnerabilities
	@echo "${GREEN}Scanning dependencies for vulnerabilities...${NC}"
	npm audit

fix-vulnerabilities: ## Fix dependency vulnerabilities
	@echo "${GREEN}Fixing dependency vulnerabilities...${NC}"
	npm audit fix

##@ Helpers

create-env: ## Create environment file template
	@echo "${GREEN}Creating environment file template...${NC}"
	@cat > env.json <<EOF
{
  "Parameters": {
    "ENVIRONMENT": "local",
    "LOG_LEVEL": "DEBUG",
    "TABLE_NAME": "clkk-app-table-local"
  }
}
EOF
	@echo "Created env.json template"

init: install create-env ## Initialize project
	@echo "${GREEN}Project initialized successfully!${NC}"
	@echo "Next steps:"
	@echo "  1. Update env.json with your configuration"
	@echo "  2. Create your GraphQL schema in graphql/schema.graphql"
	@echo "  3. Run 'make build' to build the project"
	@echo "  4. Run 'make local-api' to start local development"