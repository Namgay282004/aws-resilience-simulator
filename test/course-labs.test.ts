import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import type { LabReference } from '../src/data/courseLabs.ts';
import { findContainingSubnetBoundary } from '../src/engine/layout/containment.ts';
import { COURSE_LABS } from '../src/data/courseLabs.ts';
import { runLabReference } from '../src/engine/labs/runLabReference.ts';
import { AWS_SERVICES } from '../src/data/serviceCatalog.ts';

const denied = new Set(['lab1-deny', 'lab3-blocked', 'lab7-unavailable', 'lab8-unavailable', 'lab9-direct-denied', 'lab9-write-denied', 'lab10-latest-invalid', 'lab11-versioning-invalid', 'lab12-container-invalid', 'lab13-silence-invalid']);
test('Course index has all thirteen course lab references', () => {
  assert.deepEqual(COURSE_LABS.map(l => l.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  assert.equal(new Set(COURSE_LABS.map(l => l.sourceUrl)).size, 13);
});
for (const lab of COURSE_LABS) for (const ref of lab.references) {
  test(`${ref.id}: reference outcome, valid graph, immutable and deterministic`, () => {
    const before = structuredClone(ref);
    assert.equal(new Set(ref.nodes.map(n => n.id)).size, ref.nodes.length, 'unique node IDs');
    assert.equal(new Set(ref.edges.map(e => e.id)).size, ref.edges.length, 'unique edge IDs');
    assert.equal(ref.scenario.id, ref.id, 'scenario identity follows its variant');
    assert.ok(ref.nodes.some(n => n.id === ref.scenario.startNodeId));
    for (const n of ref.nodes) for (const sg of n.data.securityGroupIds ?? []) {
      assert.ok(ref.nodes.some(candidate => candidate.id === sg && candidate.data.boundaryType === 'security_group'));
    }
    for (const node of ref.nodes.filter(n => n.type === 'serviceNode')) assert.ok(AWS_SERVICES.some(s => s.id === node.data.serviceId), node.data.serviceId);
    for (const edge of ref.edges) {
      assert.ok(ref.nodes.some(n => n.id === edge.source));
      assert.ok(ref.nodes.some(n => n.id === edge.target));
    }
    const result = runLabReference(ref);
    assert.equal(result.success, !denied.has(ref.id), result.summary);
    assert.ok(result.steps.length);
    assert.deepEqual(ref, before);
    assert.deepEqual(runLabReference(ref), result);
    if (ref.id === 'lab5-failover') {
      assert.ok(result.path.includes('lab-task-b'));
      assert.ok(!result.path.includes('lab-task-a'));
    }
    if (ref.id === 'lab3-blocked') assert.match(result.summary, /Security Group/);
    if (ref.configurationChecks) {
      assert.equal(result.totalLatencyMs, 0);
      assert.deepEqual(result.path, []);
      assert.match(result.summary, /No request, function, build, deployment/);
      assert.ok(result.steps.every(s => s.details?.decision?.metadata.runtimeExecuted === false));
    }
    if (ref.authorization) assert.ok(result.steps.every(s => s.details?.decision?.component === 'IAM'));
    if (lab.number === 7 || lab.number === 8) {
      assert.deepEqual(result.path, ['lab-gateway', ref.scenario.path === '/results/' ? 'lab-results' : 'lab-enrolment']);
      assert.match(result.summary, /no scheduler, HPA/);
      assert.equal(ref.nodes.find(n => n.id === 'lab-results')!.data.health, 'healthy');
      assert.equal(ref.nodes.find(n => n.id === 'lab-cluster')!.data.customConfig!.managedNodeGroup.desiredSize, 2);
      assert.equal(ref.nodes.find(n => n.id === 'lab-enrolment')!.data.replicas, ['lab8-four', 'lab8-unavailable'].includes(ref.id) ? 4 : 2);
    }
  });
}

// Reserve 140×140 for the rendered icon, wrapped label and notes. The engine's
// 120×80 center-point estimate alone cannot catch cards spilling over a border.
const card = (node: LabReference['nodes'][number]) => ({ ...node.position, width: 140, height: 140 });
const bounds = (node: LabReference['nodes'][number]) => ({ ...node.position, width: Number(node.style?.width), height: Number(node.style?.height) });
const contains = (outer: ReturnType<typeof card>, inner: ReturnType<typeof card>, padding = 16) =>
  inner.x >= outer.x + padding && inner.y >= outer.y + padding &&
  inner.x + inner.width <= outer.x + outer.width - padding && inner.y + inner.height <= outer.y + outer.height - padding;

for (const lab of COURSE_LABS) for (const ref of lab.references) {
  test(`${ref.id}: readable layout and complete subnet placement`, () => {
    const services = ref.nodes.filter(n => n.type === 'serviceNode');
    const subnets = ref.nodes.filter(n => ['public_subnet', 'private_subnet'].includes(String(n.data.boundaryType)));
    const vpc = ref.nodes.find(n => n.id === 'lab-vpc');
    for (const subnet of subnets) assert.ok(vpc && contains(bounds(vpc), bounds(subnet)), `${subnet.id} spills outside VPC`);
    for (const service of services) {
      if (service.data.subnet === 'private' || service.data.subnet === 'public') {
        const subnet = findContainingSubnetBoundary(service, ref.nodes);
        assert.ok(subnet && contains(bounds(subnet), card(service)), `${service.id} spills outside its subnet`);
        assert.equal(subnet.data.boundaryType, `${service.data.subnet}_subnet`);
        if (service.data.az !== 'Multi-AZ') assert.equal(service.data.az, subnet.data.az);
      }
      if (['route_tables', 's3_gateway_endpoint', 'internet_gateway'].includes(service.data.serviceId)) {
        assert.ok(vpc && contains(bounds(vpc), card(service)), `${service.id} spills outside VPC`);
        assert.equal(findContainingSubnetBoundary(service, ref.nodes), null, `${service.id} should use the VPC infrastructure lane`);
      }
      for (const other of services.filter(n => n.id > service.id)) {
        const a = card(service), b = card(other);
        assert.ok(a.x + a.width + 16 <= b.x || b.x + b.width + 16 <= a.x || a.y + a.height + 16 <= b.y || b.y + b.height + 16 <= a.y, `${service.id} crowds ${other.id}`);
      }
    }
  });
}

test('Lab 2: S3 endpoint request survives NAT failure', () => {
  // AWS gateway endpoints reach S3 without NAT:
  // https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html
  const ref = structuredClone(COURSE_LABS[1].references[0]);
  ref.nodes.find(n => n.id === 'lab-nat')!.data.health = 'failed';
  const result = runLabReference(ref);
  assert.equal(result.success, true, result.summary);
  assert.deepEqual(result.path, ['lab-probe', 'lab-endpoint', 'lab-bucket']);
});

test('Lab 5: no available ECS tasks prevents a successful request', () => {
  const ref = structuredClone(COURSE_LABS[4].references[0]);
  ref.nodes.filter(n => n.data.serviceId === 'ecs').forEach(n => { n.data.health = 'failed'; });
  assert.equal(runLabReference(ref).success, false);
});

test('Lab 5: task SG removal of inbound access denies the ALB request', () => {
  const ref = structuredClone(COURSE_LABS[4].references[0]);
  ref.nodes.find(n => n.id === 'lab-task-sg')!.data.securityGroupRules = { inbound: [], outbound: [] };
  const result = runLabReference(ref);
  assert.equal(result.success, false);
  assert.match(result.summary, /Security Group/);
});


test('Labs 1–13 link to the current course navigation filenames', () => {
  const filenames = ['Lab-01-IAM.html', 'Lab-02-VPC.html', 'Lab-03-EC2.html', 'Lab-04-ECS.html', 'Lab-05-ALB.html', 'Lab-06-autoscaling.html', 'Lab-07-EKS.html', 'Lab-08-EKS-scaling.html', 'Lab-09-security.html', 'Lab-10-lambda.html', 'Lab-11-pipeline.html', 'Lab-12-ECSpipeline.html', 'Lab-13-monitoring.html'];
  assert.deepEqual(COURSE_LABS.map(lab => lab.sourceUrl.split('/').pop()), filenames);
});

for (const [number, nodeId, field, badValue, checkId] of [
  [10, 'lab-edge-viewer', 'region', 'eu-west-1', 'lab-edge-viewer-region'],
  [10, 'lab-edge-response', 'vpcAttached', true, 'lab-edge-response-vpc'],
  [10, 'lab-edge-viewer', 'trustPrincipals', ['lambda.amazonaws.com'], 'lab-edge-viewer-edgelambda.amazonaws.com'],
  [10, 'lab-notifier', 'region', 'eu-west-1', 'notification-region'],
  [11, 'lab-build', 'buildspec', 'missing.yml', 'buildspec'],
  [11, 'lab-source', 'versioning', false, 'source-versioning'],
  [13, 'lab-notifier-logs', 'retentionInDays', 0, 'notifier-retention'],
  [13, 'lab-notifier', 'tracing', 'PassThrough', 'active-tracing']
] as const) {
  test(`Lab ${number}: edited ${nodeId}.${field} fails its configuration check`, () => {
    const ref = structuredClone(COURSE_LABS.find(l => l.number === number)!.references[0]);
    ref.nodes.find(n => n.id === nodeId)!.data.customConfig![field] = badValue;
    const result = runLabReference(ref);
    assert.equal(result.success, false);
    assert.equal(result.steps.find(step => step.id === checkId)!.status, 'failed');
  });
}

for (const number of [10, 11, 12, 13]) {
  test(`Lab ${number}: missing checked component or relationship cannot pass`, () => {
    const base = COURSE_LABS.find(l => l.number === number)!.references[0];
    const ref = structuredClone(base);
    const nodeId = ref.configurationChecks![0].nodeId;
    ref.nodes = ref.nodes.filter(n => n.id !== nodeId);
    assert.equal(runLabReference(ref).success, false);
    const broken = structuredClone(base);
    const link = broken.configurationChecks!.find(c => c.operator === 'connection')!;
    broken.edges = broken.edges.filter(e => e.source !== link.nodeId || e.target !== link.otherNodeId);
    assert.equal(runLabReference(broken).success, false);
  });
}

test('Every lab reference has its own JSON source in src/data/labs/, with no lost or extra references', () => {
  const folder = new URL('../src/data/labs/', import.meta.url);
  const files = readdirSync(folder).filter(name => name.endsWith('.json'));
  const allReferences = COURSE_LABS.flatMap(lab => lab.references);
  assert.equal(files.length, allReferences.length);
  const ids = new Set<string>();
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(new URL(file, folder), 'utf8'));
    assert.ok(!ids.has(parsed.id), `duplicate lab reference id in ${file}`);
    ids.add(parsed.id);
    assert.deepEqual(parsed, allReferences.find(ref => ref.id === parsed.id), `${file} does not match the loaded reference`);
  }
});
