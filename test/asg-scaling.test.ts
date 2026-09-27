import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { advanceAsg, resetAsg, asgReady } from '../src/engine/scaling/asg.ts';
import { ASG_REFERENCE } from '../src/data/asgReference.ts';
import { parseDraft, serializeDraft } from '../src/engine/persistence/draft.ts';
import { runSimulation } from '../src/engine/simulation/requestSimulator.ts';
const initial = () => { const graph = structuredClone({ nodes: ASG_REFERENCE.nodes, edges: ASG_REFERENCE.edges }); graph.nodes.find(n => n.id === 'asg-group')!.data.customConfig.asg.metricSource = 'manual'; graph.nodes.find(n => n.id === 'asg-alarm')!.data.customConfig.threshold = 80; return graph; };
const tick = (g: ReturnType<typeof initial>, value?: number) => advanceAsg(g.nodes, g.edges, 'asg-group', value);
const generated = (g: ReturnType<typeof initial>) => g.nodes.filter(n => n.data.customConfig?.asgInstance?.generated);
// ASG-SIMPLE-001. AWS rule: alarm invokes adjustment, group bounds limit growth;
// cooldown prevents consecutive simple-policy actions. Explicit samples model full periods.
// https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-simple-step.html
// Architecture: ASG_REFERENCE; two baseline members, +1 adjustment, max4, two breaching samples.
test('ASG explicit alarm periods create deterministic instances, obey cooldown and max', () => {
  const base = initial(); const snapshot = JSON.stringify(base);
  const first = tick(base, 90); assert.equal(generated(first).length, 0);
  assert.equal(first.nodes.find(n => n.id === 'asg-alarm')!.data.customConfig.asgAlarm.state, 'INSUFFICIENT_DATA');
  const second = tick(first, 90); assert.equal(generated(second).length, 1);
  assert.equal(generated(second)[0].data.customConfig.asgInstance.state, 'Launching');
  assert.notEqual(generated(second)[0].data.networkIdentity.privateIp, '10.40.1.10');
  assert.deepEqual(second, tick(first, 90)); assert.equal(JSON.stringify(base), snapshot);
  const third = tick(second, 90); assert.equal(generated(third).length, 1); assert.equal(asgReady(generated(third)[0].data), true);
  const fourth = tick(third, 90); assert.equal(generated(fourth).length, 1);
  let result = tick(fourth, 90); assert.equal(generated(result).length, 2);
  for (let i = 0; i < 10; i++) result = tick(result, 90);
  assert.equal(generated(result).length, 2); assert.equal(new Set(result.nodes.map(n => n.id)).size, result.nodes.length);
});
test('Missing samples and failed CloudWatch do not trigger scaling; invalid config is atomic', () => {
  let g = tick(initial(), 90); g = tick(g); assert.equal(generated(g).length, 0);
  g.nodes.find(n => n.id === 'asg-alarm')!.data.health = 'failed';
  g = tick(g, 90); g = tick(g, 90); assert.equal(generated(g).length, 0);
  const bad = initial(); bad.nodes.find(n => n.id === 'asg-group')!.data.customConfig.asg.max = 100;
  const before = JSON.stringify(bad); assert.throws(() => tick(bad, 90), /Invalid ASG/); assert.equal(JSON.stringify(bad), before);
  const noSubnet = initial(); noSubnet.nodes.find(n => n.id === 'asg-web-1')!.data.networkIdentity.subnetId = 'missing';
  assert.throws(() => tick(tick(noSubnet, 90), 90), /subnet/);
});
test('Explicit ownership rejects duplicate membership and never modifies unrelated EC2 nodes', () => {
  const g = initial(); const other = structuredClone(g.nodes.find(n => n.id === 'asg-web-2')!); other.id = 'unrelated'; g.nodes.push(other);
  const scaled = tick(tick(g, 90), 90);
  assert.deepEqual(scaled.nodes.find(n => n.id === 'unrelated'), other);
  const second = structuredClone(g.nodes.find(n => n.id === 'asg-group')!); second.id = 'other-group'; second.data.customConfig.asg.alarmId = '';
  g.nodes.push(second); assert.throws(() => tick(g, 90), /two ASGs/);
});
test('Launching EC2 cannot serve; healthy registered targets remain available', () => {
  const g = tick(tick(initial(), 90), 90); const fresh = generated(g)[0];
  const scenario = { startNodeId: fresh.id, method: 'GET', path: '/', protocol: 'HTTP', trafficLevel: 'normal' } as any;
  assert.equal(runSimulation(g.nodes as any, g.edges as any, scenario, { legacyCapacity: false }).statusCode, 503);
  const routed = runSimulation(g.nodes as any, g.edges as any, { ...scenario, startNodeId: 'asg-alb' }, { legacyCapacity: false });
  assert.equal(routed.success, true); assert.ok(!routed.path.includes(fresh.id));
  for (const id of ['asg-web-1', 'asg-web-2']) g.nodes.find(n => n.id === id)!.data.health = 'failed';
  assert.equal(runSimulation(g.nodes as any, g.edges as any, { ...scenario, startNodeId: 'asg-alb' }, { legacyCapacity: false }).statusCode, 503);
  const ready = tick(g, 20);
  const result = runSimulation(ready.nodes as any, ready.edges as any, { ...scenario, startNodeId: 'asg-alb' }, { legacyCapacity: false });
  assert.equal(result.success, true); assert.ok(result.path.includes(fresh.id));
});
test('Draft preserves scaling clock, ownership and pending launch; reset removes only generated resources', () => {
  const g = tick(tick(initial(), 90), 90);
  const fixture = parseDraft(readFileSync(new URL('./fixtures/draft-v1.json', import.meta.url), 'utf8'));
  const saved = parseDraft(serializeDraft({ ...fixture, nodes: g.nodes as any, edges: g.edges as any }));
  assert.deepEqual(tick(saved, 90), tick(g, 90));
  const reset = resetAsg(saved.nodes, saved.edges);
  assert.equal(generated(reset).length, 0); assert.equal(reset.nodes.length, initial().nodes.length);
  assert.equal(reset.edges.length, initial().edges.length);
  assert.equal(reset.nodes.find(n => n.id === 'asg-group')!.data.customConfig.asgRuntime, undefined);
  assert.equal(reset.nodes.find(n => n.id === 'asg-alarm')!.data.customConfig.asgAlarm, undefined);
  assert.equal(reset.nodes.find(n => n.id === 'asg-web-1')!.data.customConfig.asgInstance, undefined);
});
test('Live mode does not fabricate scale-out from a stray ASG or Multi-AZ', () => {
  const g = initial();
  const result = runSimulation(g.nodes as any, g.edges as any, { startNodeId: 'asg-web-1', method: 'GET', path: '/', trafficLevel: '100x' } as any, { legacyCapacity: false });
  assert.ok(!result.steps.some(s => s.action.includes('Dynamic Scale-Out')));
});

test('Warmup is observable and an ALARM during cooldown does not produce extra instances', () => {
  const g = initial(); const config = g.nodes.find(n => n.id === 'asg-group')!.data.customConfig.asg;
  config.period = 30; config.warmupSeconds = 60;
  const launched = tick(tick(g, 90), 90);
  const warming = tick(launched, 90);
  assert.equal(generated(warming)[0].data.customConfig.asgInstance.state, 'Warming');
  assert.equal(asgReady(generated(warming)[0].data), true, 'warmup excludes metric participation, not application traffic after successful startup');
  assert.equal(generated(warming).length, 1);
});
test('Demo works through the strict live request entry point and excludes unready instances', async () => {
  const { runLiveSimulation } = await import('../src/engine/simulation/liveSimulation.ts');
  const g = tick(tick(initial(), 90), 90);
  const scenario = { startNodeId: 'asg-alb', method: 'GET', path: '/', trafficLevel: 'normal' } as any;
  const result = runLiveSimulation(g.nodes as any, g.edges as any, scenario);
  assert.equal(result.success, true, result.summary);
  assert.ok(!result.path.includes(generated(g)[0].id));
  assert.ok(!result.steps.some(s => s.action.includes('Dynamic Scale-Out')));
});

test('Canvas ALB traffic drives CloudWatch and grows only the connected ASG', async () => {
  const { observeAlbRequests } = await import('../src/engine/scaling/albObservation.ts');
  const { runLiveSimulation } = await import('../src/engine/simulation/liveSimulation.ts');
  const scenario = { startNodeId: 'asg-alb', method: 'GET', path: '/', trafficLevel: 'normal' } as any;
  let graph = structuredClone({ nodes: ASG_REFERENCE.nodes, edges: ASG_REFERENCE.edges });
  const send = () => { graph = observeAlbRequests(graph.nodes, graph.edges, runLiveSimulation(graph.nodes as any, graph.edges as any, scenario)); };
  send(); assert.equal(generated(graph).length, 0);
  send(); assert.equal(generated(graph).length, 1);
  assert.equal(graph.nodes.find(n => n.id === 'asg-alarm')!.data.customConfig.asgObservation.value, 60);
  send(); send();
  assert.equal(graph.nodes.find(n => n.id === 'asg-alarm')!.data.customConfig.asgObservation.value, 40);
  const disconnected = structuredClone({ nodes: ASG_REFERENCE.nodes, edges: ASG_REFERENCE.edges.filter(e => e.id !== 'asg-alb-metrics') });
  const noAction = observeAlbRequests(disconnected.nodes, disconnected.edges, runLiveSimulation(disconnected.nodes as any, disconnected.edges as any, scenario));
  assert.equal(generated(noAction).length, 0); assert.match(noAction.notes.join(' '), /monitoring connection/);
});
test('Illustrative target tracking calculates demand, clamps to max, and never scales in', async () => {
  const g = initial(); const group = g.nodes.find(n => n.id === 'asg-group')!;
  group.data.customConfig.asg = { ...group.data.customConfig.asg, metricSource: 'alb', policyType: 'target', targetValue: 50 };
  let graph = advanceAsg(g.nodes, g.edges, group.id, 120, 2);
  graph = advanceAsg(graph.nodes, graph.edges, group.id, 120, 2);
  assert.equal(generated(graph).length, 2);
  graph = advanceAsg(graph.nodes, graph.edges, group.id, 1, 4);
  assert.equal(graph.nodes.find(n => n.id === group.id)!.data.customConfig.asgRuntime.desired, 4);
});

test('Canvas clock advances pending launches without targets; unrelated requests cannot scale', async () => {
  const { observeAlbRequests } = await import('../src/engine/scaling/albObservation.ts');
  const { runLiveSimulation } = await import('../src/engine/simulation/liveSimulation.ts');
  let g = structuredClone({ nodes: ASG_REFERENCE.nodes, edges: ASG_REFERENCE.edges });
  const scenario = { startNodeId: 'asg-alb', method: 'GET', path: '/', trafficLevel: 'normal' } as any;
  const send = () => { g = observeAlbRequests(g.nodes, g.edges, runLiveSimulation(g.nodes as any, g.edges as any, scenario)); };
  const unrelated = observeAlbRequests(g.nodes, g.edges, runLiveSimulation(g.nodes as any, g.edges as any, { ...scenario, startNodeId: 'asg-web-1' }));
  assert.equal(unrelated.nodes.find(n => n.id === 'asg-group')!.data.customConfig.asgRuntime, undefined);
  send(); send();
  for (const id of ['asg-web-1', 'asg-web-2']) g.nodes.find(n => n.id === id)!.data.health = 'failed';
  send();
  assert.equal(generated(g)[0].data.customConfig.asgInstance.state, 'InService');
  assert.equal(g.nodes.find(n => n.id === 'asg-alarm')!.data.customConfig.asgObservation.value, null);
});
