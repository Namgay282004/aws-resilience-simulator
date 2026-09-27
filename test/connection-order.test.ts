import test from 'node:test';
import assert from 'node:assert/strict';
import { orderConnections, orderTargets } from '../src/engine/simulation/connectionOrder.ts';
import { runSimulation } from '../src/engine/simulation/requestSimulator.ts';
const node = (id: string, serviceId: string): any => ({ id, position: { x: 0, y: 0 }, data: { serviceId, label: id, health: 'healthy', subnet: 'global' } });
const edge = (target: string, stepNumber?: number): any => ({ id: target, source: 'user', target, data: { protocol: 'HTTPS', stepNumber } });
test('Ordering is stable, ignores invalid numbers and does not mutate inputs', () => {
  const edges = [edge('a'), edge('b', 3), edge('c', 1), edge('d', 3), edge('e', -1)];
  assert.deepEqual(orderConnections(edges).map(e => e.target), ['c', 'b', 'd', 'a', 'e']);
  assert.equal(edges[0].target, 'a');
  const nodes = [node('a', 's3'), node('b', 's3')];
  assert.strictEqual(orderTargets(nodes, [edge('a')]), nodes);
});
test('Live traversal follows numbered branches rather than node insertion order', () => {
  const nodes = [node('user', 'user'), node('a', 's3'), node('b', 's3')];
  const scenario: any = { id: 's', name: 's', method: 'GET', path: '/', startNodeId: 'user', trafficLevel: 'normal' };
  assert.deepEqual(runSimulation(nodes, [edge('a'), edge('b')], scenario).path, ['user', 'a']);
  assert.deepEqual(runSimulation(nodes, [edge('a', 2), edge('b', 1)], scenario).path, ['user', 'b']);
});
test('Numbered S3 path outranks messaging adapter, while unnumbered behavior is retained', () => {
  const nodes = [node('user', 'user'), node('q', 'sqs'), node('bucket', 's3')];
  const scenario: any = { id: 's', name: 's', method: 'GET', path: '/', startNodeId: 'user', trafficLevel: 'normal' };
  const numbered = runSimulation(nodes, [edge('q', 2), edge('bucket', 1)], scenario);
  assert.ok(numbered.path.includes('bucket'));
  assert.equal(numbered.serviceStates?.q, undefined);
  const legacy = runSimulation(nodes, [edge('q'), edge('bucket')], scenario);
  assert.equal(legacy.serviceStates?.q.messages.length, 1);
});
test('Numbered load-balancer targets still fail over to a healthy target', () => {
  const nodes = [node('user', 'alb'), node('a', 'ec2'), node('b', 'ec2')];
  nodes[1].data.health = 'failed';
  const result = runSimulation(nodes, [edge('a', 1), edge('b', 2)], { id: 's', name: 's', method: 'GET', path: '/', startNodeId: 'user', trafficLevel: 'normal' });
  assert.ok(result.path.includes('b'));
  assert.ok(!result.path.includes('a'));
});
