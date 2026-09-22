import test from 'node:test';
import assert from 'node:assert/strict';
import { findContainingSubnetBoundary, deriveSubnetForNode } from '../src/engine/layout/containment.ts';
import { validateNetworkIdentities } from '../src/engine/architecture/networkIdentity.ts';
import { runSimulation } from '../src/engine/simulation/requestSimulator.ts';
const subnet: any = { id: 'private', type: 'boundaryNode', position: { x: 0, y: 0 }, data: { boundaryType: 'private_subnet', width: 400, height: 300 } };
const resource: any = { id: 'ec2', position: { x: 20, y: 20 }, data: { serviceId: 'ec2', label: 'EC2', health: 'healthy', subnet: 'private' } };
const scenario = { id: 'test', name: 'test', method: 'GET' as const, path: '/', trafficLevel: 'normal' as const, startNodeId: 'ec2' };
test('Explicit subnet membership survives movement and JSON roundtrip; legacy placement still works', () => {
  assert.equal(findContainingSubnetBoundary(resource, [subnet])?.id, 'private');
  const assigned = JSON.parse(JSON.stringify({ ...resource, position: { x: 5000, y: 5000 }, data: { ...resource.data, networkIdentity: { subnetId: 'private' } } }));
  assert.equal(deriveSubnetForNode(assigned, [subnet]), 'private');
  assert.deepEqual(validateNetworkIdentities([assigned, subnet]), []);
  assert.equal(runSimulation([assigned, subnet], [], scenario).success, true);
});
test('Deleted or wrong-type explicit subnet fails closed despite overlapping geometry', () => {
  for (const subnetId of ['deleted', 'ec2']) {
    const assigned = { ...resource, data: { ...resource.data, networkIdentity: { subnetId } } };
    assert.equal(findContainingSubnetBoundary(assigned, [subnet]), null);
    assert.equal(validateNetworkIdentities([assigned, subnet]).length, 1);
    assert.equal(runSimulation([assigned, subnet], [], scenario).statusCode, 400);
  }
});
test('Explicit resource VPC must match subnet VPC; stale route tables are rejected', () => {
  const vpc = (id: string): any => ({ id, type: 'boundaryNode', position: { x: 0, y: 0 }, data: { boundaryType: 'vpc' } });
  const assignedSubnet = { ...subnet, data: { ...subnet.data, networkIdentity: { vpcId: 'vpc-a' } } };
  const assigned = { ...resource, data: { ...resource.data, networkIdentity: { subnetId: 'private', vpcId: 'vpc-b', routeTableId: 'missing' } } };
  const findings = validateNetworkIdentities([assigned, assignedSubnet, vpc('vpc-a'), vpc('vpc-b')]);
  assert.ok(findings.some(f => f.problem.includes('does not match')));
  assert.ok(findings.some(f => f.problem.includes('routeTableId')));
});
