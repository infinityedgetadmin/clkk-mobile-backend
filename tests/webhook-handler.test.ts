import { describe, it, expect } from '@jest/globals';
import { createApiGatewayEvent, createMockContext } from './test-utils';

describe('Webhook Handler Unit Tests', () => {
  it('should validate basic test setup', () => {
    expect(true).toBe(true);
  });

  it('should create a valid API Gateway event', () => {
    const event = createApiGatewayEvent({
      path: '/webhooks/clerk/users',
      method: 'POST',
      body: {
        type: 'user.created',
        data: {
          id: 'user_test123',
          email_addresses: [{
            email_address: 'test@example.com'
          }]
        }
      }
    });

    expect(event.httpMethod).toBe('POST');
    expect(event.path).toBe('/webhooks/clerk/users');
    expect(event.body).toBeDefined();
    const body = event.body || '{}';
    expect(JSON.parse(body).type).toBe('user.created');
  });

  it('should create a valid Lambda context', () => {
    const context = createMockContext();
    
    expect(context.functionName).toBe('test-function');
    expect(context.awsRequestId).toBe('test-request-id');
    expect(context.getRemainingTimeInMillis()).toBe(30000);
  });
});