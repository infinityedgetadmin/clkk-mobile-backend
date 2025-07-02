# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development Workflow
```bash
# Initial setup
make install          # Install all dependencies including Lambda layers
make generate-types   # Generate TypeScript types from GraphQL schema

# Development
make build           # Build SAM application with TypeScript compilation
make local-api       # Start local API with hot reload
make test            # Run all tests
make lint            # Run ESLint
make format          # Format code with Prettier

# Testing specific files
npm test -- path/to/test.file.ts                    # Run single test file
npm test -- --testNamePattern="test name"           # Run tests by name
npm test -- services/users                          # Run tests in directory

# Deployment
make deploy-dev      # Deploy to development
make deploy-staging  # Deploy to staging
make deploy-prod     # Deploy to production (with confirmation)
```

### Debugging & Monitoring
```bash
make logs            # Tail CloudWatch logs for a function
make describe-stack  # View stack details
make list-outputs    # List stack outputs (API endpoints, etc.)
```

## Architecture Overview

This is a GraphQL-first serverless backend with strong typing and no hardcoded strings. The architecture follows Domain-Driven Design with clear separation between business logic (entities) and data access (repositories).

### Key Architectural Patterns

1. **Single-Table DynamoDB Design**
   - All data in one table with entity prefixes (USER#, WALLET#, TXN#)
   - Multiple GSIs for different access patterns
   - All keys/attributes defined in constants layer

2. **Lambda Layers Structure**
   - `constants/` - All DynamoDB attributes, indexes, key builders (NO hardcoded strings)
   - `entities/` - Domain models with business logic
   - `repositories/` - Data access layer
   - `common/` - Shared utilities
   - `graphql-types/` - Generated TypeScript types from schema
   - `powertools/` - AWS Lambda Powertools configuration

3. **GraphQL Code Generation**
   - Schema defined in `graphql/schema.graphql`
   - Types auto-generated to `layers/graphql-types/`
   - Full type safety across resolvers

### Critical Coding Patterns

**Never use hardcoded strings for DynamoDB:**
```typescript
// ❌ WRONG
item.PK = `USER#${userId}`;
item.email = email;

// ✅ CORRECT
import { ATTRIBUTES, KEY_BUILDERS } from '@layers/constants';
item[ATTRIBUTES.PARTITION_KEY] = KEY_BUILDERS.user(userId)[ATTRIBUTES.PARTITION_KEY];
item[ATTRIBUTES.EMAIL] = email;
```

**Domain model pattern:**
```typescript
// Use entities for business logic
const user = User.fromGraphQLInput(input);
await user.create();

// Use repositories for queries
const userRepo = new UserRepository();
const user = await userRepo.getByEmail('test@example.com');
```

## Project Structure

```
├── graphql/              # GraphQL schema and codegen config
├── layers/               # Shared Lambda layers
│   ├── constants/        # DynamoDB constants (CRITICAL: use these!)
│   ├── entities/         # Domain models
│   ├── repositories/     # Data access
│   └── powertools/       # Observability
├── services/             # Lambda functions by domain
│   └── users/           # User service functions
├── stacks/              # CloudFormation nested stacks
└── shared/              # Shared Lambda handler base
```

## Testing Approach

- Test files: `__tests__/*.test.ts` or `*.test.ts`
- Unit tests: Include "unit" in path
- Integration tests: Include "integration" in path
- Mock AWS SDK with `aws-sdk-client-mock`

## Important Notes

1. **Missing Configuration Files**: The project currently lacks `tsconfig.json`, `.eslintrc`, and `.prettierrc` files. These are referenced but not present.

2. **Generated Files**: Always run `make generate-types` after modifying GraphQL schema.

3. **Environment Variables**: Create `env.json` for local development (use `make create-env` for template).

4. **AWS Lambda Powertools**: Integrated for structured logging, tracing, and metrics. Logger is pre-initialized in the Lambda base handler.

## CI/CD with GitHub Actions

The project includes GitHub Actions workflows for automated deployment:

### Workflows
- **deploy-dev.yml**: Auto-deploys to dev on push to main/develop
- **deploy-staging-prod.yml**: Deploys to staging/prod with version tags (v*)
- **pr-checks.yml**: Runs tests, linting, and security checks on PRs

### Required GitHub Secrets
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` for dev/staging
- `PROD_AWS_ACCESS_KEY_ID` and `PROD_AWS_SECRET_ACCESS_KEY` for production

### Deployment
- Development: Push to main/develop branch
- Staging/Production: Create and push version tag (e.g., `git tag v1.0.0`)

### Custom Domains
- Integrates with CLKK platform shared domain
- Uses `mobile-api` subdomain pattern
- Cross-account DNS for dev/staging environments
- Deploy with: `./scripts/deploy-with-shared-domain.sh`
- Platform parameters required in SSM:
  - `/clkk/platform/domain-name`
  - `/clkk/platform/hosted-zone-id`
  - `/clkk/platform/certificates/mobile`

## AWS Profile and Environment Configuration

- When working with AWS CLI or AWS SDK, use specific profile configurations
  - For mobile development: `AWS_PROFILE=clkk-mobile-dev`
  - For SaaS development: `AWS_PROFILE=clkk-saas-dev`
  - Always set `AWS_SDK_LOAD_CONFIG=1` to ensure proper profile loading
  - These configurations should prefix all AWS API requests to ensure correct account and permissions