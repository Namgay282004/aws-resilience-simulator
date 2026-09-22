import test from 'node:test';
import assert from 'node:assert/strict';
import { carriesRequest, isDependencyCall, relationshipKind } from '../src/engine/architecture/relationships.ts';
import { runLiveSimulation } from '../src/engine/simulation/liveSimulation.ts';
test('Legacy relationships retain forwarding/dependency meaning; explicit relationships take precedence', () => {
  assert.equal(carriesRequest(undefined), true);
  assert.equal(isDependencyCall({ traversal: 'dependency' }), true);
  assert.equal(relationshipKind({ relationship: 'manages', traversal: 'forward' }), 'manages');
  for (const relationship of ['manages', 'route-association', 'target-registration'] as const) {
    assert.equal(carriesRequest({ relationship }), false);
    assert.equal(isDependencyCall({ relationship }), false);
  }
  assert.equal(carriesRequest({ signalType: 'outbound_response' }), false);
});
test('Live execution never follows a management edge to a failed resource', () => {
  const nodes: any[] = ['source', 'target'].map((id, i) => ({ id, position: { x: i * 200, y: 0 }, data: {
    serviceId: 's3', label: id, subnet: 'global', health: i ? 'failed' : 'healthy'
  } }));
  const edges: any[] = [{ id: 'management', source: 'source', target: 'target', data: { relationship: 'manages' } }];
  const result = runLiveSimulation(nodes, edges, { id: 'test', name: 'test', method: 'GET', path: '/', startNodeId: 'source', trafficLevel: 'normal' });
  assert.equal(result.success, true);
  assert.ok(result.steps.every(step => step.targetNodeId !== 'target'));
  assert.match(result.summary, /control-plane behavior is not yet simulated/);
});
