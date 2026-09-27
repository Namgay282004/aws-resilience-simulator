import test from 'node:test';
import assert from 'node:assert/strict';
import { operate } from '../src/engine/services/operations.ts';
import { runSimulation } from '../src/engine/simulation/requestSimulator.ts';
const node = (id: string, serviceId: string, customConfig = {}): any => ({ id, position: { x: 0, y: 0 }, data: { serviceId, label: id, health: 'healthy', subnet: 'global', customConfig } });
const edge = (source: string, target: string, data = {}): any => ({ id: `${source}-${target}`, source, target, data });
const runtime = (nodes: any[], id: string) => nodes.find(n => n.id === id).data.customConfig.serviceRuntime;
// Sources: docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
// docs.aws.amazon.com/sns/latest/dg/sns-subscription-filter-policies.html
// docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/alarms-and-missing-data.html
// docs.aws.amazon.com/awscloudtrail/latest/userguide/logging-management-events-with-cloudtrail.html

test('SQS receive hides but does not delete; expiry redelivers with a new receipt', () => {
  let nodes = [node('q', 'sqs')];
  const original = structuredClone(nodes);
  nodes = operate(nodes, [], 'q', 'send').nodes;
  assert.deepEqual(original, [node('q', 'sqs')]);
  nodes = operate(nodes, [], 'q', 'receive').nodes;
  const receipt = runtime(nodes, 'q').messages[0].receipt;
  assert.match(operate(nodes, [], 'q', 'receive').trace[0], /no visible/);
  nodes = operate(nodes, [], 'q', 'advance', { seconds: 30 }).nodes;
  nodes = operate(nodes, [], 'q', 'receive').nodes;
  assert.equal(runtime(nodes, 'q').messages[0].receives, 2);
  assert.throws(() => operate(nodes, [], 'q', 'delete', { receipt }), /receipt handle/);
  nodes = operate(nodes, [], 'q', 'delete', { receipt: runtime(nodes, 'q').messages[0].receipt }).nodes;
  assert.equal(runtime(nodes, 'q').messages.length, 0);
});
test('SNS fanout is per subscription, filters attributes and requires queue permission', () => {
  const nodes = [node('topic', 'sns'), node('a', 'sqs', { allowedTopicIds: ['topic'] }), node('b', 'sqs'), node('c', 'sqs', { allowedTopicIds: ['topic'] })];
  const edges = [edge('topic', 'a'), edge('topic', 'b'), edge('topic', 'c', { filterPolicy: { kind: ['invoice'] } })];
  const result = operate(nodes, edges, 'topic', 'publish', { attributes: { kind: 'order' } });
  assert.equal(runtime(result.nodes, 'a').messages.length, 1);
  assert.equal(runtime(result.nodes, 'b'), undefined);
  assert.equal(runtime(result.nodes, 'c'), undefined);
  assert.ok(result.trace.some(s => s.includes('policy')));
  assert.ok(result.trace.some(s => s.includes('filtered')));
  assert.deepEqual(operate(nodes, edges, 'topic', 'publish'), operate(nodes, edges, 'topic', 'publish'));
});
test('CloudWatch ALARM transitions publish to SNS once; missing data follows configuration', () => {
  let nodes = [node('cw', 'cloudwatch'), node('topic', 'sns'), node('q', 'sqs', { allowedTopicIds: ['topic'] })];
  const edges = [edge('cw', 'topic'), edge('topic', 'q')];
  nodes = operate(nodes, edges, 'cw', 'metric', { value: 90 }).nodes;
  assert.equal(runtime(nodes, 'cw').alarm, 'ALARM');
  assert.equal(runtime(nodes, 'q').messages.length, 1);
  nodes = operate(nodes, edges, 'cw', 'metric', { value: 95 }).nodes;
  assert.equal(runtime(nodes, 'q').messages.length, 1);
  nodes = operate(nodes, edges, 'cw', 'metric').nodes;
  assert.equal(runtime(nodes, 'cw').alarm, 'INSUFFICIENT_DATA');
  nodes[0].data.customConfig.treatMissingData = 'notBreaching';
  assert.equal(runtime(operate(nodes, edges, 'cw', 'metric').nodes, 'cw').alarm, 'OK');
});
test('CloudTrail includes management events by default, data events only with opt-in', () => {
  let nodes = [node('trail', 'cloudtrail'), node('q', 'sqs')];
  nodes = operate(nodes, [], 'trail', 'audit').nodes;
  nodes = operate(nodes, [], 'trail', 'audit', { category: 'data' }).nodes;
  assert.equal(runtime(nodes, 'trail').records.length, 1);
  nodes[0].data.customConfig.includeDataEvents = true;
  nodes = operate(nodes, [edge('q', 'trail')], 'q', 'send').nodes;
  assert.equal(runtime(nodes, 'trail').records.length, 2);
  nodes[0].data.customConfig.loggingEnabled = false;
  nodes = operate(nodes, [], 'trail', 'audit').nodes;
  assert.equal(runtime(nodes, 'trail').records.length, 2);
});
test('Failure injection and unsupported FIFO do not silently accept sends', () => {
  const failed = node('q', 'sqs'); failed.data.health = 'failed';
  assert.throws(() => operate([failed], [], 'q', 'send'), /unavailable/);
  assert.throws(() => operate([node('q', 'sqs', { queueType: 'fifo' })], [], 'q', 'send'), /FIFO/);
});
test('Live producer publishes through SNS to connected queues and produces persistable state', () => {
  const nodes = [node('client', 'api_client'), node('topic', 'sns'), node('q', 'sqs', { allowedTopicIds: ['topic'] })];
  const result = runSimulation(nodes, [edge('client', 'topic'), edge('topic', 'q')], { id: 's', name: 's', startNodeId: 'client', method: 'POST', path: '/message', trafficLevel: 'normal' });
  assert.equal(result.success, true);
  assert.equal(result.serviceStates?.q.messages.length, 1);
  assert.equal(nodes[2].data.customConfig.serviceRuntime, undefined, 'pure run must not mutate canvas inputs');
});
test('Live CloudWatch and CloudTrail starts use behavior operations, not terminal passthrough', () => {
  const scenario: any = { id: 's', name: 's', method: 'POST', path: '/', trafficLevel: 'normal' };
  const cw = runSimulation([node('cw', 'cloudwatch', { metricValue: 90 })], [], { ...scenario, startNodeId: 'cw' });
  assert.equal(cw.serviceStates?.cw.alarm, 'ALARM');
  const trail = runSimulation([node('trail', 'cloudtrail')], [], { ...scenario, startNodeId: 'trail' });
  assert.equal(trail.serviceStates?.trail.records.length, 1);
});
