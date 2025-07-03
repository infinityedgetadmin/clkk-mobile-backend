# CLKK Backend Tests

This directory contains simplified tests for the CLKK Backend V3.

## Structure

- `webhook-handler.test.ts` - Tests for Clerk webhook handlers
- `graphql-resolver.test.ts` - Tests for GraphQL resolvers
- `test-utils.ts` - Utility functions for creating test events

## Running Tests

From this directory:
```bash
npm install
npm test
```

## Note

These are simplified unit tests that verify basic functionality. For integration tests with actual AWS services, you would need to:

1. Set up proper AWS credentials
2. Use actual DynamoDB tables or local DynamoDB
3. Mock or use actual Lambda layers

The tests are structured to be easily expandable once the module resolution issues are resolved.