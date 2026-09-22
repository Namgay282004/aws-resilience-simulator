/**
 * UI integration tests (Phase 13). These render the REAL `ArchitectureProvider` (the seam every
 * component in `src/components/` calls into) inside a jsdom document via `react-dom`, and drive
 * it through the exact same public API a component would call - `addServiceNode`, `updateNodeData`,
 * `runScenario`, `injectFailure`, etc. This is deliberately not a mock: AWS semantics stay in the
 * engines (`engine/simulation`, `engine/failure`, `engine/validation`, `engine/analysis`,
 * `engine/trace`) exactly as `ArchitectureContext.tsx` wires them; these tests only assert on the
 * STATE/RESULTS React would then display, never re-implement or second-guess the engine logic.
 *
 * Run via: `npm run test:ui` (needs the esbuild-backed JSX loader in `test/support/`, since
 * `ArchitectureContext.tsx` contains JSX in its Provider - see test/support/jsxLoader.mjs). Lives
 * in its own `test/ui/` subdirectory (not `test/*.test.ts`) so the main `test`/`test:unit` scripts
 * - which run under plain `--experimental-strip-types` with no JSX support - never pick it up.
 */
import assert from 'node:assert';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/'
});
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { act } = React;
const { createRoot } = await import('react-dom/client');
const { ArchitectureProvider, useArchitecture } = await import('../../src/context/ArchitectureContext.tsx');
const { ServiceInspector } = await import('../../src/components/inspector/ServiceInspector.tsx');

type Api = ReturnType<typeof useArchitecture>;

/** Exposes the live `useArchitecture()` return value to the test via a ref - this IS the display
 *  layer's real read of context state; the test drives it exactly as a component would. */
function Harness({ apiRef }: { apiRef: { current: Api | null } }) {
  const ctx = useArchitecture();
  apiRef.current = ctx;
  return null;
}

const { SimulationControls } = await import('../../src/components/simulation/SimulationControls.tsx');
const { LabsModal } = await import('../../src/components/labs/LabsModal.tsx');
const { COURSE_LABS } = await import('../../src/data/courseLabs.ts');

async function mount(showInspector = false, showLabs = false, showControls = false) {
  const container = document.getElementById('root')!;
  const root = createRoot(container);
  const apiRef: { current: Api | null } = { current: null };
  await act(async () => {
    root.render(React.createElement(ArchitectureProvider, null, React.createElement(Harness, { apiRef }), showInspector ? React.createElement(ServiceInspector) : null, showLabs ? React.createElement(LabsModal, { isOpen: true, onClose: () => {} }) : null, showControls ? React.createElement(SimulationControls) : null));
  });
  return {
    api: () => apiRef.current!,
    act: async (fn: () => void) => {
      await act(async () => { fn(); });
    },
    unmount: async () => {
      await act(async () => { root.unmount(); });
    }
  };
}

test('1. Build architecture: adding services and connecting them updates the Architecture Model', async () => {
  const h = await mount();

  await h.act(() => h.api().addServiceNode('alb', { x: 0, y: 0 }));
  await h.act(() => h.api().addServiceNode('ec2', { x: 200, y: 0 }));

  const alb = h.api().nodes.find(n => n.data.serviceId === 'alb')!;
  const ec2 = h.api().nodes.find(n => n.data.serviceId === 'ec2')!;
  assert.ok(alb && ec2, 'both service nodes must exist on the model after addServiceNode');

  await h.act(() => h.api().onConnect({ source: alb.id, target: ec2.id, sourceHandle: null, targetHandle: null }));

  const edge = h.api().edges.find(e => e.source === alb.id && e.target === ec2.id);
  assert.ok(edge, 'the connection must appear in the Architecture Model edges');

  await h.unmount();
});

test('Labs: select instructions, run ALB failover, then load a clean editable reference', async () => {
  const h = await mount(false, true);
  try {
    const button = (text: string) => [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text))!;
    assert.equal(document.querySelectorAll('nav[aria-label="Course labs"] button').length, 13);
    await h.act(() => button('Lab 5').click());
    assert.match(document.querySelector('a')!.href, /Lab-05-ALB.html$/);
    const runButtons = [...document.querySelectorAll('button')].filter(b => b.textContent === 'Run reference simulation');
    await h.act(() => runButtons[1].click());
    assert.equal(h.api().appMode, 'simulate');
    assert.equal(h.api().simulationResult?.success, true);
    assert.ok(h.api().simulationResult?.path.includes('lab-task-b'));
    await h.act(() => h.api().openLabReference(COURSE_LABS[3].references[0]));
    assert.equal(h.api().appMode, 'design');
    assert.equal(h.api().simulationResult, null);
    assert.equal(h.api().isPlaying, false);
    await h.act(() => h.api().runScenario());
    assert.equal(h.api().simulationResult?.success, true, h.api().simulationResult?.summary);
    assert.equal(COURSE_LABS[5].references[0].nodes.find(n => n.id === 'lab-task-a')!.data.health, 'healthy');
    await h.act(() => button('Lab 7').click());
    assert.match(document.querySelector('a')!.href, /Lab-07-EKS.html$/);
    await h.act(() => button('Lab 8').click());
    assert.match(document.querySelector('a')!.href, /Lab-08-EKS-scaling.html$/);
    const eksRuns = [...document.querySelectorAll('button')].filter(b => b.textContent === 'Run reference simulation');
    await h.act(() => eksRuns[1].click());
    assert.equal(h.api().simulationResult?.success, true);
    assert.match(h.api().simulationResult!.summary, /no scheduler, HPA/);
    assert.equal(h.api().nodes.find(n => n.id === 'lab-enrolment')!.data.replicas, 4);
  } finally { await h.unmount(); }
});

test('2. Configure service: editing a node writes through to the Architecture Model', async () => {
  const h = await mount();
  await h.act(() => h.api().addServiceNode('rds', { x: 0, y: 0 }));
  const rds = h.api().nodes.find(n => n.data.serviceId === 'rds')!;

  await h.act(() => h.api().updateNodeData(rds.id, { multiAz: true, label: 'Orders DB' }));

  const updated = h.api().nodes.find(n => n.id === rds.id)!;
  assert.strictEqual(updated.data.multiAz, true, 'service configuration change must feed the Architecture Model');
  assert.strictEqual(updated.data.label, 'Orders DB');

  await h.unmount();
});

test('3. Send Request: view a successful flow with request path, decision points, and AWS explanation', async () => {
  const h = await mount();
  await h.act(() => h.api().loadTemplate('highly-available-multiaz'));
  await h.act(() => h.api().runScenario());

  const { simulationResult, requestTrace } = h.api();
  assert.ok(simulationResult, 'Send Request must produce a simulation result');
  assert.strictEqual(simulationResult!.success, true, 'the HA template should simulate a successful request');
  assert.ok(simulationResult!.path.length > 1, 'the result must expose the traversed request path');

  assert.ok(requestTrace, 'a successful simulation must produce an explainable AWS decision trace');
  assert.ok(requestTrace!.entries.length > 0, 'the trace must contain decision points');
  assert.ok(requestTrace!.entries.every(e => e.awsRule.length > 0), 'every decision point must carry an AWS explanation');
  assert.strictEqual(requestTrace!.final, 'SUCCESS');

  await h.unmount();
});

test('4. Send Request: view a failed flow with a DENIED trace and a WHY', async () => {
  const h = await mount();
  await h.act(() => h.api().loadTemplate('highly-available-multiaz'));

  // Fail every compute target so the load balancer has nothing healthy to route to.
  const ecsNodes = h.api().nodes.filter(n => n.data.serviceId === 'ecs');
  for (const n of ecsNodes) {
    await h.act(() => h.api().setNodeHealth(n.id, 'failed', 'Task crashed'));
  }
  await h.act(() => h.api().runScenario());

  const { simulationResult, requestTrace } = h.api();
  assert.strictEqual(simulationResult!.success, false, 'the request must fail with no healthy compute targets');
  assert.strictEqual(simulationResult!.statusCode, 503);

  if (requestTrace) {
    // The trace may legitimately stop at the ALB hop (no further hop is reached once denied) -
    // what matters is that a denial is explained, not that every reference-template hop appears.
    assert.strictEqual(requestTrace.final, 'DENIED');
    assert.ok(requestTrace.why.length > 0, 'a denied request must carry a WHY');
  }

  await h.unmount();
});

test('5. Inject failure: the Failure Lab engine propagates a structured failure into the model', async () => {
  const h = await mount();
  await h.act(() => h.api().loadTemplate('highly-available-multiaz'));

  await h.act(() => h.api().injectFailure({
    targetResourceId: 'AZ-A',
    failureType: 'az_failure',
    severity: 'critical',
    trigger: 'manual',
    reason: 'Zone Outage (AZ-A Hardware Failure)'
  }));

  const { activeFailures, failureImpacts, effectiveNodes } = h.api();
  assert.strictEqual(activeFailures.length, 1, 'the injected failure must be tracked');
  assert.ok(failureImpacts.length > 0, 'the failure engine must produce an impact analysis');

  const azANode = effectiveNodes.find(n => n.id === 'node-ecs-az-a')!;
  assert.strictEqual(azANode.data.health, 'failed', 'the effective model must reflect the direct failure');
  const azBNode = effectiveNodes.find(n => n.id === 'node-ecs-az-b')!;
  assert.strictEqual(azBNode.data.health, 'healthy', 'a failure in one AZ must not affect resources in another AZ');

  await h.act(() => h.api().restoreAllNodes());
  assert.strictEqual(h.api().activeFailures.length, 0, 'restoring must clear the injected failure');

  await h.unmount();
});

test('6. Analyze architecture: validation and analysis engines are wired to the model', async () => {
  const h = await mount();
  await h.act(() => h.api().loadTemplate('basic-spof-app'));

  const { validationFindings, architecturalFindings } = h.api();
  assert.deepStrictEqual(
    validationFindings.filter(f => f.severity === 'CRITICAL'),
    [],
    'a structurally valid template should have no CRITICAL configuration findings'
  );
  assert.ok(
    architecturalFindings.some(f => f.subcategory === 'spof'),
    'the SPOF-ridden basic-spof-app template must be flagged by the analysis engine'
  );
  assert.ok(
    architecturalFindings.some(f => f.subcategory === 'redundancy'),
    'the Single-AZ, single-instance template must be flagged for missing redundancy'
  );

  await h.unmount();
});

test('7. React only displays state - the context never requires a component to compute AWS semantics itself', async () => {
  const h = await mount();
  await h.act(() => h.api().loadTemplate('highly-available-multiaz'));
  await h.act(() => h.api().runScenario());

  // Everything a component needs to display is already-computed data on the context - a
  // component (or this test, standing in for one) never calls into an engine module directly.
  const api = h.api();
  for (const key of ['analysis', 'validationFindings', 'architecturalFindings', 'simulationResult', 'requestTrace', 'failureImpacts']) {
    assert.ok(key in api, `context must expose "${key}" as ready-to-display state`);
  }

  await h.unmount();
});


test('Inspector scopes NACL configuration to subnets and keeps EC2 security groups', async () => {
  const h = await mount(true);
  try {
    await h.act(() => h.api().addServiceNode('ec2', { x: 0, y: 0 }));
    const config = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Config')!;
    await h.act(() => config.click());
    assert.match(document.body.textContent!, /Security Groups/);
    assert.doesNotMatch(document.body.textContent!, /Network ACL|NACL Rules/);
    await h.act(() => h.api().setShowNaclSideColumn(true));
    await h.act(() => h.api().addBoundaryNode('private_subnet', { x: 0, y: 0 }));
    assert.equal(h.api().showNaclSideColumn, false);
    assert.match(document.body.textContent!, /Network ACL/);
    await h.act(() => h.api().addServiceNode('s3', { x: 600, y: 600 }));
    assert.doesNotMatch(document.body.textContent!, /Attach Security Group|NACL Rules|Network ACL/);
  } finally { await h.unmount(); }
});


test('Labs 9–13: select, check supplied references, then recheck edited canvas configuration', async () => {
  const h = await mount(false, true, true);
  try {
    for (const number of [9, 10, 11, 12, 13]) {
      const nav = [...document.querySelectorAll('nav[aria-label="Course labs"] button')].find(b => b.textContent?.startsWith(`Lab ${number} ·`)) as HTMLElement;
      await h.act(() => nav.click());
      const lab = COURSE_LABS.find(l => l.number === number)!;
      assert.equal(document.querySelector('a')!.href, lab.sourceUrl);
      const run = [...document.querySelectorAll('button')].find(b => b.textContent === (number === 9 ? 'Run reference simulation' : 'Check reference configuration'))!;
      await h.act(() => run.click());
      assert.equal(h.api().simulationResult?.success, true, `Lab ${number} reference`);
      if (number !== 9) {
        assert.match(h.api().simulationResult!.summary, /Configuration PASS/);
        assert.ok(document.body.textContent?.includes('Check Configuration'));
      }
    }
    const revision = h.api().canvasRevision;
    await h.act(() => h.api().openLabReference(COURSE_LABS[10].references[0]));
    assert.ok(h.api().canvasRevision > revision, 'fresh lab triggers fit-to-view');
    const source = h.api().nodes.find(n => n.id === 'lab-source')!;
    await h.act(() => h.api().updateNodeData(source.id, { customConfig: { ...source.data.customConfig, versioning: false } }));
    await h.act(() => h.api().runScenario());
    assert.equal(h.api().simulationResult!.success, false);
    assert.match(h.api().simulationResult!.summary, /source requires bucket versioning/);
    assert.equal(COURSE_LABS[10].references[0].nodes.find(n => n.id === 'lab-source')!.data.customConfig!.versioning, true);
    await h.act(() => h.api().loadTemplate('highly-available-multiaz'));
    assert.equal(h.api().activeLabReference, null);
    await h.act(() => h.api().runScenario());
    assert.equal(h.api().simulationResult!.success, true);
    assert.doesNotMatch(h.api().simulationResult!.summary, /Configuration PASS/);
  } finally { await h.unmount(); }
});

test('Loaded IAM lab keeps policy evaluation when run again', async () => {
  const h = await mount();
  try {
    await h.act(() => h.api().openLabReference(COURSE_LABS[8].references[3]));
    await h.act(() => h.api().runScenario());
    assert.equal(h.api().simulationResult!.success, false);
    assert.ok(h.api().simulationResult!.steps.every(step => step.details?.decision?.component === 'IAM'));
    await h.act(() => h.api().clearCanvas());
    assert.equal(h.api().activeLabReference, null);
  } finally { await h.unmount(); }
});

test('Lab configuration editor applies JSON and rejects malformed settings', async () => {
  const h = await mount(true);
  try {
    await h.act(() => h.api().openLabReference(COURSE_LABS[9].references[0]));
    await h.act(() => h.api().setSelectedNodeId('lab-edge-viewer'));
    const button = (text: string) => [...document.querySelectorAll('button')].find(b => b.textContent === text)!;
    await h.act(() => button('Config').click());
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Lab configuration JSON"]')!;
    assert.ok(textarea);
    const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value')!.set!;
    const edit = async (value: string) => h.act(() => {
      setValue.call(textarea, value);
      textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await edit('{');
    await h.act(() => button('Apply lab settings').click());
    assert.match(document.querySelector('[role="alert"]')!.textContent!, /valid JSON object/);
    assert.equal(h.api().nodes.find(n => n.id === 'lab-edge-viewer')!.data.customConfig!.version, '1');
    await edit(JSON.stringify({ ...h.api().nodes.find(n => n.id === 'lab-edge-viewer')!.data.customConfig, version: '$LATEST' }));
    await h.act(() => button('Apply lab settings').click());
    await h.act(() => h.api().runScenario());
    assert.equal(h.api().simulationResult!.success, false);
    assert.equal(h.api().simulationResult!.steps.find(step => step.id === 'lab-edge-viewer-version')!.status, 'failed');
  } finally { await h.unmount(); }
});


test('Lab AZ failure respects customer subnet placement', async () => {
  const h = await mount();
  try {
    await h.act(() => h.api().openLabReference(COURSE_LABS[1].references[0]));
    await h.act(() => h.api().failAvailabilityZone('AZ-A'));
    assert.equal(h.api().nodes.find(n => n.id === 'lab-probe')!.data.health, 'failed');
    assert.equal(h.api().nodes.find(n => n.id === 'lab-nat')!.data.health, 'failed');
    assert.equal(h.api().nodes.find(n => n.id === 'lab-bucket')!.data.health, 'healthy');
  } finally { await h.unmount(); }
});

test('ECS explorer is opt-in, persists component edits, groups services, and closes with Escape', async () => {
  const h = await mount(true);
  try {
    await h.act(() => h.api().addServiceNode('ecs', { x: 0, y: 0 }));
    const ecs = h.api().nodes.filter(n => n.data.serviceId === 'ecs').at(-1)!;
    await h.act(() => h.api().updateNodeData(ecs.id, { customConfig: { sentinel: 'preserved', ecsWorkspace: { clusterName: 'test-cluster' } } }));
    await h.act(() => h.api().setSelectedNodeId(ecs.id));
    assert.equal(document.querySelector('[aria-label="ECS component details"]'), null);
    const button = (text: string) => [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text))!;
    const opener = button('More information');
    opener.focus();
    await h.act(() => opener.click());
    assert.ok(document.querySelector('[role="dialog"]'));
    await h.act(() => button('Task definition · not configured').click());
    await h.act(() => button('Add container').click());
    assert.equal(h.api().nodes.find(n => n.id === ecs.id)!.data.customConfig!.ecsWorkspace.containers.length, 1);
    assert.equal(h.api().nodes.find(n => n.id === ecs.id)!.data.customConfig!.sentinel, 'preserved');
    const cluster = document.querySelector('[aria-label="ECS cluster boundary"]')!;
    const serviceBoundary = cluster.querySelector('[aria-label^="Service boundary:"]')!;
    const task = serviceBoundary.querySelector('[aria-label="Task snapshot 1"]')!;
    assert.ok(task.querySelector('[aria-label^="Configure container"]'), 'containers must be nested inside tasks inside services inside the cluster');
    await h.act(() => (task.querySelector('[aria-label^="Configure container"]') as HTMLButtonElement).click());
    assert.match(document.querySelector('[aria-label="ECS component details"]')!.textContent!, /Container configuration/);
    const nameInput = [...document.querySelectorAll('[aria-label="ECS component details"] label')].find(l => l.textContent === 'Container name')!.querySelector('input')!;
    await h.act(() => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(nameInput, 'web-container');
      nameInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    assert.match(task.textContent!, /web-container/);
    await h.act(() => h.api().updateNodeData(ecs.id, { customConfig: { ...h.api().nodes.find(n => n.id === ecs.id)!.data.customConfig, ecs: { runningCount: 0, desiredCount: 3 } } }));
    assert.equal(serviceBoundary.querySelectorAll('[aria-label^="Task snapshot "]').length, 0);
    assert.match(serviceBoundary.textContent!, /No observed running tasks/);
    await h.act(() => h.api().updateNodeData(ecs.id, { customConfig: { ...h.api().nodes.find(n => n.id === ecs.id)!.data.customConfig, ecs: { runningCount: 100, desiredCount: 100 } } }));
    assert.equal(serviceBoundary.querySelectorAll('[aria-label^="Task snapshot "]').length, 6);
    assert.match(serviceBoundary.textContent!, /94 more tasks/);

    await h.act(() => button('EC2 · container instances').click());
    const select = document.querySelector('[role="dialog"] select') as HTMLSelectElement;
    await h.act(() => { select.value = 'FARGATE'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.match(document.querySelector('[role="dialog"]')!.textContent!, /Fargate · AWS-managed compute/);
    assert.doesNotMatch(document.querySelector('[aria-label="ECS component details"]')!.textContent!, /EC2 instance type/);
    assert.equal(h.api().nodes.find(n => n.id === ecs.id)!.data.customConfig!.ecs.launchType, 'FARGATE');
    await h.act(() => h.api().addServiceNode('ecs', { x: 200, y: 0 }));
    const second = h.api().nodes.filter(n => n.data.serviceId === 'ecs').at(-1)!;
    await h.act(() => h.api().updateNodeData(second.id, { customConfig: { ecsWorkspace: { clusterName: 'test-cluster', serviceName: 'Second service' } } }));
    await h.act(() => h.api().setSelectedNodeId(ecs.id));
    // Selection changes dismiss the overlay; reopen it explicitly.
    await h.act(() => button('More information').click());
    assert.equal(document.querySelectorAll('[aria-label="Cluster services"] > section').length, 2);
    await h.act(() => button('Second service').click());
    assert.match(document.querySelector('[role="dialog"]')!.textContent!, /Second service/);
    const modal = document.querySelector('[role="dialog"]')!;
    await h.act(() => modal.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(document.querySelector('[role="dialog"]'), null);
    await h.act(() => button('More information').click());
    assert.match(document.querySelector('[role="dialog"]')!.textContent!, /Fargate · AWS-managed compute/);
  } finally { await h.unmount(); }
});

test('Service lessons follow their icons, preserve architecture, and distinguish scaling from RunTask', async () => {
  const h = await mount(true);
  try {
    const button = (text: string) => [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text))!;
    const openService = async (service: string) => {
      await h.act(() => h.api().addServiceNode(service, { x: 0, y: 0 }));
      const node = h.api().nodes.filter(n => n.data.serviceId === service).at(-1)!;
      await h.act(() => h.api().setSelectedNodeId(node.id));
      await h.act(() => button('More information').click());
      return node;
    };
    await openService('ecs');
    assert.ok(document.querySelector('[aria-label="ECS cluster boundary"]'));
    assert.equal(document.querySelector('[aria-label="ECS supporting concepts"]'), null);
    assert.equal(document.querySelector('[aria-label="Scaling policy demonstration"]'), null);
    await openService('sqs');
    const lab = () => document.querySelector('[aria-label="Scaling policy demonstration"]')!;
    assert.match(lab().textContent!, /backlog/);
    const before = JSON.stringify(h.api().nodes);
    const slider = lab().querySelector('input[type="range"]')!;
    await h.act(() => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(slider, '300');
      slider.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await h.act(() => button('Animate scaling').click());
    await h.act(() => button('Pause').click());
    assert.match(lab().textContent!, /Capacity bounds 1–8: 6/);
    await h.act(() => button('Next stage').click());
    await h.act(() => button('Next stage').click());
    assert.match(lab().textContent!, /Starting/);
    await h.act(() => button('Next stage').click());
    assert.match(lab().textContent!, /6 ready \/ 6 desired/);
    assert.equal(JSON.stringify(h.api().nodes), before);
    await h.act(() => button('Reset demo').click());
    assert.match(lab().textContent!, /2 ready \/ 2 desired/);
    const available = lab().querySelector('input[type="checkbox"]') as HTMLInputElement;
    await h.act(() => available.click());
    await h.act(() => button('Animate scaling').click());
    assert.match(lab().textContent!, /Insufficient metric data/);
    assert.equal(JSON.stringify(h.api().nodes), before);
    await openService('nlb');
    assert.equal(document.querySelector('[aria-label="Scaling policy demonstration"]'), null);
    const routing = () => document.querySelector('[aria-label="Load balancer demonstration"]')!;
    assert.match(routing().textContent!, /NLB · Layer 4/);
    await h.act(() => button('Send on same TCP flow').click());
    const receiving = () => [...routing().querySelectorAll('strong')].find(n => n.parentElement?.textContent?.includes('Receiving traffic'))?.textContent;
    assert.equal(receiving(), 'api target 1');
    await h.act(() => button('Send on same TCP flow').click());
    assert.equal(receiving(), 'api target 1');
    await h.act(() => button('Open new connection').click());
    await h.act(() => button('Send on same TCP flow').click());
    assert.equal(receiving(), 'api target 2');
    assert.equal(routing().querySelectorAll('select').length, 1, 'NLB cannot switch itself to an ALB');
    await openService('alb');
    assert.match(routing().textContent!, /ALB · Layer 7/);
    await h.act(() => button('Send HTTP request').click());
    assert.equal(receiving(), 'api target 1');
    const path = routing().querySelector('select')!;
    await h.act(() => { path.value = '/'; path.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    await h.act(() => button('Send HTTP request').click());
    assert.equal(receiving(), 'web target 1');
    assert.equal(routing().querySelector('[aria-label="Load balancer boundary"]')!.querySelector('[aria-label="api example target group"]'), null);
    await openService('eventbridge');
    const events = () => document.querySelector('[aria-label="EventBridge task invocation demonstration"]')!;
    const eventBefore = JSON.stringify(h.api().nodes);
    await h.act(() => button('Publish example event').click());
    assert.match(events().textContent!, /1 standalone task examples/);
    assert.match(events().textContent!, /desired count 2 \(unchanged\)/);
    const eventSelect = events().querySelector('select')!;
    await h.act(() => { eventSelect.value = 'OrderCancelled'; eventSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    await h.act(() => button('Publish example event').click());
    assert.match(events().textContent!, /Event did not match/);
    assert.match(events().textContent!, /1 standalone task examples/);
    assert.equal(JSON.stringify(h.api().nodes), eventBefore);
    assert.doesNotMatch(events().textContent!, /ChangeInCapacity/);
    await openService('cloudwatch');
    assert.match(lab().textContent!, /CloudWatch provides metrics and alarms/);
    assert.equal([...lab().querySelectorAll('option')].some(o => o.value === 'scheduled'), false);
    const policy = lab().querySelector('select')!;
    await h.act(() => { policy.value = 'step'; policy.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    for (const expression of ['ChangeInCapacity', 'PercentChangeInCapacity', 'ExactCapacity']) assert.match(lab().textContent!, new RegExp(expression));
    await openService('ec2_auto_scaling');
    assert.match(lab().textContent!, /EC2 Auto Scaling group/);
    assert.ok([...lab().querySelectorAll('option')].some(o => o.value === 'scheduled'));
    await openService('eventbridge_scheduler');
    assert.match(events().textContent!, /Schedule → RunTask/);
    await openService('ecr_registry');
    assert.match(document.querySelector('[role="dialog"]')!.textContent!, /ECR repository/);
  } finally { await h.unmount(); }
});

test('Draft roundtrip restores workspace, scenario, failures, results and viewport; malformed import is atomic', async () => {
  const h = await mount();
  try {
    await h.act(() => h.api().loadTemplate('highly-available-multiaz'));
    await h.act(() => {
      h.api().setScenario(s => ({ ...s, path: '/saved-draft' }));
      h.api().setDraftViewport({ x: 42, y: -30, zoom: 0.8 });
      h.api().setPlaybackSpeed(2);
      h.api().injectFailure({ targetResourceId: 'node-ecs-az-a', failureType: 'instance_unavailable', severity: 'high', trigger: 'manual' });
    });
    await h.act(() => h.api().runScenario());
    await h.act(() => h.api().setIsPlaying(false));
    const saved = h.api().exportDraft();
    const snapshot = JSON.parse(saved).state;
    await h.act(() => h.api().clearCanvas());
    await h.act(() => h.api().importDraft(saved));
    assert.deepStrictEqual(h.api().scenario, snapshot.scenario);
    assert.deepStrictEqual(h.api().activeFailures, snapshot.activeFailures);
    assert.deepStrictEqual(h.api().simulationResult, snapshot.simulationResult);
    assert.deepStrictEqual(h.api().draftViewport, snapshot.viewport);
    assert.equal(h.api().nodes.length, snapshot.nodes.length);
    assert.equal(h.api().edges.length, snapshot.edges.length);
    assert.equal(h.api().isPlaying, false);
    assert.equal(h.api().playbackSpeed, 2);
    const before = h.api().nodes;
    assert.throws(() => h.api().importDraft('{"version":99}'), /Unsupported/);
    assert.strictEqual(h.api().nodes, before);
    const broken = JSON.parse(saved); broken.state.edges[0].target = 'missing';
    assert.throws(() => h.api().importDraft(JSON.stringify(broken)), /missing nodes/);
    assert.strictEqual(h.api().nodes, before);
  } finally { await h.unmount(); }
});

test('Release indicator offers same-channel update and restores a tab recovery draft', async () => {
  const { ReleaseStatus } = await import('../../src/components/layout/ReleaseStatus.tsx');
  const { UPDATE_RECOVERY_KEY } = await import('../../src/engine/releases/release.ts');
  const previousFetch = globalThis.fetch;
  const previousStorage = (globalThis as any).sessionStorage;
  (globalThis as any).sessionStorage = dom.window.sessionStorage;
  const h = await mount();
  let saved: string;
  try { saved = h.api().exportDraft(); } finally { await h.unmount(); }
  dom.window.sessionStorage.setItem(UPDATE_RECOVERY_KEY, saved!);
  globalThis.fetch = (async () => ({ ok: true, json: async () => ({ version: '1.1.0', buildId: 'new-build', channel: 'preview', draftVersion: 2 }) })) as any;
  const root = createRoot(document.getElementById('root')!);
  const oldConfirm = window.confirm;
  window.confirm = () => true;
  try {
    await act(async () => root.render(React.createElement(ArchitectureProvider, null, React.createElement(ReleaseStatus))));
    assert.match(document.body.textContent ?? '', /preview/);
    assert.match(document.body.textContent ?? '', /Update available/);
    const restore = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Restore work'))!;
    assert.ok(restore);
    await act(async () => restore.click());
    assert.equal(dom.window.sessionStorage.getItem(UPDATE_RECOVERY_KEY), null);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = previousFetch;
    (globalThis as any).sessionStorage = previousStorage;
    window.confirm = oldConfirm;
  }
});
