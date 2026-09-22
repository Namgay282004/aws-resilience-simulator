import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEndpoint, validateEndpoint } from '../src/engine/network/vpcEndpoint.ts';
import { runSimulation } from '../src/engine/simulation/requestSimulator.ts';

// AWS rule/source: one selected service per endpoint; gateway types support S3/DynamoDB.
// https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html
const endpoint = { serviceId: 's3_gateway_endpoint', health: 'healthy' };
test('Gateway endpoint defaults preserve existing S3 diagrams and reject other services', () => {
  assert.equal(evaluateEndpoint(endpoint, 's3').allowed, true);
  assert.equal(evaluateEndpoint(endpoint, 'dynamodb').allowed, false);
  assert.equal(evaluateEndpoint({ ...endpoint, customConfig: { endpointService: 'dynamodb' } }, 'dynamodb').allowed, true);
  assert.equal(validateEndpoint({ ...endpoint, customConfig: { endpointService: 'sqs' } }).length, 1);
});
test('Interface endpoint requires an explicit service; failure and mismatch deny access', () => {
  assert.equal(evaluateEndpoint({ serviceId: 'privatelink' }, 'sqs').allowed, false);
  const configured = { serviceId: 'privatelink', customConfig: { endpointService: 'sqs' } };
  assert.equal(evaluateEndpoint(configured, 'sqs').allowed, true);
  assert.equal(evaluateEndpoint(configured, 's3').allowed, false);
  assert.equal(evaluateEndpoint({ ...configured, health: 'failed' }, 'sqs').allowed, false);
});
const scenario = { id: 'endpoint', name: 'Endpoint', method: 'GET' as const, path: '/', startNodeId: 'endpoint', trafficLevel: 'normal' as const };
function simulate(service: string, connected = true) {
  const nodes: any[] = [
    { id: 'endpoint', position: { x: 0, y: 0 }, data: { ...endpoint, label: 'Endpoint', subnet: 'global' } },
    { id: 'target', position: { x: 200, y: 0 }, data: { serviceId: service, label: service, health: 'healthy', subnet: 'global' } }
  ];
  const edges: any[] = connected ? [{ id: 'edge', source: 'endpoint', target: 'target', data: { protocol: 'HTTPS' } }] : [];
  return runSimulation(nodes, edges, scenario);
}
test('Live pipeline enforces destination matching and rejects terminal endpoints', () => {
  assert.equal(simulate('s3').success, true);
  const denied = simulate('dynamodb');
  assert.equal(denied.success, false);
  assert.ok(denied.steps.some(step => step.explanation.includes('not dynamodb')));
  assert.equal(simulate('s3', false).success, false);
});

test('Live implicit endpoint lookup cannot use a DynamoDB endpoint for S3', () => {
  const nodes: any[] = [
    { id: 'compute', position: { x: 0, y: 0 }, data: { serviceId: 'ec2', label: 'App', subnet: 'private', health: 'healthy' } },
    { id: 's3', position: { x: 200, y: 0 }, data: { serviceId: 's3', label: 'Bucket', subnet: 'global', health: 'healthy' } },
    { id: 'endpoint', position: { x: 400, y: 0 }, data: { ...endpoint, label: 'Endpoint', subnet: 'global', customConfig: { endpointService: 'dynamodb' } } }
  ];
  const edges: any[] = [{ id: 'edge', source: 'compute', target: 's3', data: { protocol: 'HTTPS' } }];
  const request = { ...scenario, startNodeId: 'compute' };
  assert.equal(runSimulation(nodes, edges, request).success, false);
  nodes[2].data.customConfig.endpointService = 's3';
  assert.equal(runSimulation(nodes, edges, request).success, true);
});
