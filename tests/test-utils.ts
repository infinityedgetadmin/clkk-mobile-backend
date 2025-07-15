import { APIGatewayProxyEvent, Context } from 'aws-lambda';

/**
 * Creates a mock API Gateway event
 */
export function createApiGatewayEvent({
  path = '/',
  method = 'POST',
  body,
  headers = {},
  queryStringParameters = {},
  pathParameters = {},
}: {
  path?: string;
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  pathParameters?: Record<string, string>;
}): APIGatewayProxyEvent {
  return {
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    multiValueHeaders: {},
    httpMethod: method,
    isBase64Encoded: false,
    path,
    pathParameters: pathParameters || null,
    queryStringParameters: queryStringParameters || null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      authorizer: {},
      httpMethod: method,
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'Test User Agent',
        userArn: null,
      },
      path,
      protocol: 'HTTP/1.1',
      requestId: 'test-request-id',
      requestTime: '04/Mar/2020:19:15:17 +0000',
      requestTimeEpoch: 1583349317135,
      resourceId: 'resource-id',
      resourcePath: path,
      stage: 'test',
    },
    resource: path
  } as APIGatewayProxyEvent;
}

/**
 * Creates a mock Lambda context
 */
export function createMockContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: 'test-log-group',
    logStreamName: 'test-log-stream',
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  } as Context;
}

/**
 * Generate a unique test ID
 */
export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export {
  createApiGatewayEvent,
  createMockContext,
  generateTestId
};