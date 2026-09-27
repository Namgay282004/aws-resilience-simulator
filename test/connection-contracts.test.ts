import test from 'node:test';
import assert from 'node:assert/strict';
import { checkConnection, connectionProtocols } from '../src/engine/architecture/connectionContracts.ts';
import { runLiveSimulation } from '../src/engine/simulation/liveSimulation.ts';
const node = (id: string): any => ({ id, position: { x: 0, y: 0 }, data: { serviceId: id, label: id, health: 'healthy', subnet: 'global' } });
const scenario: any = { id: 's', name: 's', startNodeId: 'user', method: 'GET', path: '/', trafficLevel: 'normal' };
test('S3 and gateway reject SQL, while gateway web traffic is a forwarding path', () => {
  for (const target of ['s3', 'internet_gateway']) assert.equal(checkConnection(node('user'), node(target), { protocol: 'SQL' }).status, 'invalid');
  assert.equal(checkConnection(node('user'), node('internet_gateway'), { protocol: 'HTTPS' }).status, 'valid');
  assert.equal(checkConnection(node('user'), node('s3'), { protocol: 'Object access' }).status, 'valid');
  assert.ok(!connectionProtocols(node('ec2'), node('s3')).includes('SQL'));
});
test('API operation, transport, missing node and unknown capability are distinguished', () => {
  assert.equal(checkConnection(node('ec2'), node('s3'), { protocol: 'HTTPS', action: 'sqs:SendMessage' }).status, 'invalid');
  assert.equal(checkConnection(node('ec2'), node('s3'), { protocol: 'HTTPS', transport: 'UDP' }).status, 'invalid');
  assert.equal(checkConnection(node('ec2'), undefined).status, 'invalid');
  assert.equal(checkConnection(node('ec2'), node('new-service'), { protocol: 'HTTPS' }).status, 'unknown');
});
test('Imported invalid connections fail before terminal processing even if not critical', () => {
  for (const target of ['s3', 'internet_gateway']) {
    const result = runLiveSimulation([node('user'), node(target)], [{ id: 'e', source: 'user', target, data: { protocol: 'SQL', isCriticalDependency: false } } as any], scenario);
    assert.equal(result.success, false);
    assert.equal(result.statusCode, 400);
    assert.ok(result.steps.some(s => s.action === 'Invalid connection'));
  }
});
test('Unknown live interactions report unsupported instead of success', () => {
  const result = runLiveSimulation([node('user'), node('new-service')], [{ id: 'e', source: 'user', target: 'new-service', data: { protocol: 'HTTPS' } } as any], scenario);
  assert.equal(result.statusCode, 501);
});

test('ASG EC2 contract is management-only and supports the current catalog identifier', () => {
  assert.equal(checkConnection(node('ec2_auto_scaling'), node('ec2'), { relationship: 'manages', protocol: 'Event' }).status, 'valid');
  assert.equal(checkConnection(node('ec2_auto_scaling'), node('ec2'), { relationship: 'request', protocol: 'HTTP' }).status, 'unknown');
});
