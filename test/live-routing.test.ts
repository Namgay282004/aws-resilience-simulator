import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLiveRoute } from '../src/engine/network/liveRouting.ts';
import { runSimulation } from '../src/engine/simulation/requestSimulator.ts';
// AWS rule: longest-prefix route selection; a local route covers destinations within its VPC.
// https://docs.aws.amazon.com/vpc/latest/userguide/route-tables-priority.html
function fixture() {
  const vpc: any = { id: 'vpc', type: 'boundaryNode', position: { x: 0, y: 0 }, data: { boundaryType: 'vpc' } };
  const subnet: any = { id: 'subnet', type: 'boundaryNode', position: { x: 0, y: 0 }, data: { boundaryType: 'private_subnet', cidr: '10.0.1.0/24', networkIdentity: { vpcId: 'vpc', routeTableId: 'rt' } } };
  const source: any = { id: 'source', position: { x: 0, y: 0 }, data: { serviceId: 'ec2', label: 'App', health: 'healthy', subnet: 'private', networkIdentity: { subnetId: 'subnet' } } };
  const target: any = { id: 'target', position: { x: 0, y: 0 }, data: { serviceId: 'rds', label: 'DB', health: 'healthy', subnet: 'private', networkIdentity: { subnetId: 'subnet', privateIp: '10.0.1.20' } } };
  const table: any = { id: 'rt', position: { x: 0, y: 0 }, data: { serviceId: 'route_tables', customConfig: { routeTable: { routes: [
    { destinationCidr: '0.0.0.0/0', target: { type: 'nat', targetId: 'failed-nat' } },
    { destinationCidr: '10.0.0.0/16', target: { type: 'local' } }
  ] } } } };
  return { source, target, table, subnet, nodes: [vpc, subnet, source, target, table] };
}
test('Local route wins over NAT default and runs on the live database branch', () => {
  const f = fixture();
  assert.equal(evaluateLiveRoute(f.source, f.target, f.nodes).outcome, 'allowed');
  const result = runSimulation(f.nodes, [{ id: 'e', source: 'source', target: 'target', data: { protocol: 'SQL' } } as any], { id: 's', name: 's', startNodeId: 'source', path: '/', method: 'GET', trafficLevel: 'normal' });
  assert.equal(result.success, true);
  assert.ok(result.steps.some(step => step.action === 'Route evaluation: allowed'));
  f.table.data.customConfig.routeTable.routes = [];
  const denied = runSimulation(f.nodes, [{ id: 'e', source: 'source', target: 'target' } as any], { id: 's', name: 's', startNodeId: 'source', path: '/', method: 'GET', trafficLevel: 'normal' });
  assert.equal(denied.success, false);
  assert.equal(denied.statusCode, 504);
});
test('Unknown destination, unsupported transit and malformed tables do not claim reachability', () => {
  const f = fixture();
  f.target.data.networkIdentity.privateIp = '192.0.2.10';
  assert.equal(evaluateLiveRoute(f.source, f.target, f.nodes).outcome, 'unsupported');
  delete f.target.data.networkIdentity.privateIp;
  assert.equal(evaluateLiveRoute(f.source, f.target, f.nodes).outcome, 'unsupported');
  f.table.data.customConfig.routeTable.routes = [null];
  assert.equal(evaluateLiveRoute(f.source, f.target, f.nodes).outcome, 'invalid');
});
test('Local route cannot cross VPCs even with overlapping address ranges', () => {
  const f = fixture();
  const otherVpc: any = { id: 'other', type: 'boundaryNode', position: { x: 0, y: 0 }, data: { boundaryType: 'vpc' } };
  const otherSubnet = { ...f.subnet, id: 'other-subnet', data: { ...f.subnet.data, networkIdentity: { vpcId: 'other' } } };
  f.target.data.networkIdentity.subnetId = 'other-subnet';
  assert.equal(evaluateLiveRoute(f.source, f.target, [...f.nodes, otherVpc, otherSubnet]).outcome, 'denied');
});
