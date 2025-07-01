# CLKK Mobile Backend V3

A GraphQL-first serverless backend built with AWS SAM, TypeScript, and AWS Lambda Powertools.

## Architecture

This backend implements a modern serverless architecture with:
- **GraphQL API** via AWS AppSync
- **TypeScript** throughout with full type safety
- **AWS Lambda Powertools** for observability
- **Single-table DynamoDB** design
- **Domain-driven design** with entities and repositories
- **No hardcoded strings** - all constants centralized

## Project Structure

```
clkk-backend-v3/
├── graphql/              # GraphQL schema and code generation
├── layers/               # Shared Lambda layers
│   ├── constants/        # All DB constants (no hardcoded strings)
│   ├── entities/         # Domain models with business logic  
│   ├── repositories/     # Data access layer
│   └── powertools/       # AWS Lambda Powertools configuration
├── services/             # Microservices
│   └── users/           # User service
├── stacks/              # CloudFormation nested stacks
│   ├── api/             # AppSync API and authorizer
│   ├── database/        # DynamoDB single-table design
│   └── shared/          # Shared resources
└── shared/              # Shared utilities
    └── lambda-base/     # Optimized Lambda handler
```

## Getting Started

### Prerequisites
- Node.js 20.x
- AWS CLI configured
- SAM CLI installed
- Make installed

### Installation

```bash
# Install all dependencies
make install

# Generate GraphQL types
make generate-types

# Build the project
make build
```

### Local Development

```bash
# Start local API with hot reload
make local-api

# Run tests
make test

# Deploy to development
make deploy-dev
```

### Deployment

```bash
# Deploy to development
make deploy-dev

# Deploy to staging  
make deploy-staging

# Deploy to production (with confirmation)
make deploy-prod
```

## Key Features

### 1. No Hardcoded Strings
All DynamoDB attributes, indexes, and keys are defined in the constants layer:
```typescript
// ❌ Bad
item.PK = `USER#${userId}`;

// ✅ Good  
item[ATTRIBUTES.PARTITION_KEY] = KEY_BUILDERS.user(userId)[ATTRIBUTES.PARTITION_KEY];
```

### 2. Domain-Driven Design
Entities handle business logic, repositories handle data access:
```typescript
// Domain model
const user = User.fromGraphQLInput(input);
await user.create();

// Repository for queries
const userRepo = new UserRepository();
const user = await userRepo.getByEmail('test@example.com');
```

### 3. Optimized for Cold Starts
- Pre-initialized middleware
- Shared Lambda layers
- Connection pooling
- Efficient bundling with esbuild

### 4. Full Observability
AWS Lambda Powertools provides:
- Structured logging with correlation IDs
- Distributed tracing with X-Ray
- Custom CloudWatch metrics
- Performance monitoring

## Architecture Decisions

### Why GraphQL?
- Single endpoint for all operations
- Strong typing with code generation
- Efficient data fetching
- Built-in documentation

### Why Single-Table DynamoDB?
- Cost-effective at scale
- Consistent performance
- Supports complex access patterns
- Single source of truth

### Why Lambda Layers?
- Code reuse across functions
- Smaller deployment packages
- Centralized dependency management
- Faster cold starts

## Contributing

1. Follow the established patterns
2. No hardcoded strings - use constants
3. Write tests for new features
4. Update documentation

## License

Proprietary - All rights reserved