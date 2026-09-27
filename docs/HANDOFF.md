# Handoff — live project state

Read this before starting work. Update it before ending a session, especially
if you leave uncommitted work. This is a **snapshot**, not a changelog —
overwrite stale sections instead of appending; `git log` is the changelog.
Full objective/intent/architecture rules live in the root `CLAUDE.md` — this
file only tracks what's currently true and in flight.

Last updated: 2026-09-25 (Codex). PNG export now excludes React Flow connection handles
using the html-to-image clone filter; live canvas and actual edges remain unchanged.
Verification: production build passes (existing bundle-size warning). Previous full suite:
469 passing; not rerun for this export-only filter. No screenshot QA, commit or deployment.
Other agents' uncommitted changes preserved.

## Protocol

1. On start: read this file, then `CLAUDE.md`. Run `git status` and `npm test`
   to confirm the snapshot below still matches reality — it may not.
2. Before ending a session, or handing off mid-task: rewrite "In-flight work",
   "Known gaps", and "Next steps" to reflect the true current state. If you
   ran tests/build, record the result.
3. Don't assume a feature left by another agent is finished because it exists
   in the working tree. Per `CLAUDE.md` §31, a phase/feature is only
   complete when it is **implemented + tested + documented**. Check for a
   matching `docs/features/*.md` entry and a test file before trusting it.
4. Don't delete or rewrite another agent's uncommitted work without reading
   and understanding it first (see root-level executing-actions-with-care
   norms — this applies to other agents' in-progress work same as a
   human's).

## Current state (as of last update)

Working tree contains uncommitted changes from multiple agents. Latest test/build results above.
Do not discard unrelated changes.

### In-flight work

- **Reference catalogue modularization** — 14 finalized built-ins in `src/data/references/*.json`;
  exact snapshot equality verified against the original 3362-line module before replacement.
  `scripts/generate-references.mjs` generates `referenceRegistry.ts` before dev/build/test.
  Existing imports remain via `referenceArchitectures.ts`; `asgReference.ts` re-exports JSON.
  `ReferenceLibrary` is on the canvas top-left, removed from header. Supports search, load,
  download, import and Save as reference (diagram + optional scenario). Browser library uses
  `aws-architecture-lab.references.v1`; source export works even if browser storage fails.
  User explicitly will copy exported files into `src/data/references/` themselves. See folder README.
  `loadTemplate` accepts validated custom reference and clones it before loading; optional
  scenario restored. Full draft export remains separate. Test loader preserves JSON attributes.
  Tests: `test/reference-library.test.ts`, UI source-compatible save/load, entire regression suite.
- **Export redesign** — light responsive dialog; filename preview, primary JSON download,
  secondary upload, separate browser save/resume section. Shared `utils/saveJson.ts` handles
  native picker and download fallback, cancellation. Existing export tests pass.

- **Compact Export workflow** — header now has one Export entry for complete JSON draft
  upload/download, naming, browser save/resume, and save-location selection. Native file picker
  when available; download fallback otherwise. Old ExportModal audit/topology-only formats
  replaced as requested; image export remains. AWS Cloud canvas watermark removed.
  Test: UI export roundtrip through mocked picker plus cancellation. Doc: `docs/features/DRAFTS.md`.
- **ASG draw-link fix** — `isManagementPair` now selects management/Event at edge creation
  for ASG→EC2, CloudWatch→ASG and ALB→CloudWatch. Previously creation validated as request
  and rejected the ASG pair. Inspector no longer marks the Event label unsupported.
  Explicit ASG member/policy configuration remains required; a drawn line alone does not enroll EC2.
  Tests: connection contracts and UI draw path. Verified before nav changes: 465 tests + build.

- **Canvas-driven CloudWatch → ASG scale-out** — Send Request observes ALB target selection,
  creates a synthetic one-minute request batch from traffic level, and drives the scaling engine
  without any inspector/overlay open. `engine/scaling/albObservation.ts` requires explicit
  ALB→CloudWatch management edge and ASG member association. `asg.ts` owns lifecycle/nodes/IPs.
  CloudWatch Config exposes metric source, monitored ALB and simple/illustrative target-tracking
  policies. Selecting ALB source creates monitoring edge; manual controls hidden in ALB mode.
  Canvas badges show alarm/desired/lifecycle. Reference `cloudwatch-asg-live-scaling` now defaults
  to ALB metrics: normal120/minute, initial2 targets, threshold50, two runs create a third EC2.
  Source mappings are disclosed in panel and result summary; not measured CPU or real request volume.
  Tests: `test/asg-scaling.test.ts`, UI regression proves scaling with inspector closed.
  Read `docs/features/ASG_SCALING.md`. Drafts retain runtime; reset clears generated resources.

- **ECS capacity visualization** — compute references sit in a separate cluster section,
  outside service boundaries. Legacy per-service host metadata remains editable and is not
  summed or treated as real shared capacity. Scale-out and scale-in walkthroughs were removed
  at the user's request; the corrected layout remains.
  Doc: `docs/features/ECS_CAPACITY_VISUALIZATION.md`. UI integration covers hierarchy and Fargate.

- **Numbered connection flow** — `engine/simulation/connectionOrder.ts` sorts positive integer
  step numbers; requestSimulator orders outgoing/dependency edges and downstream targets.
  Managed-service/data-tier/endpoint adapters defer to the first numbered target; LB health
  failover remains active. Unnumbered branches retain legacy behavior. This is per-node priority,
  not a global execute-all list. The DIT admin edge explicitly targets API Gateway to preserve
  its admin flow rather than taking the shared client's numbered portal branch.
  Tests: `test/connection-order.test.ts`. Doc: `docs/features/NUMBERED_CONNECTION_FLOW.md`.

- **Connection contracts** — implemented and tested: `engine/architecture/connectionContracts.ts`;
  canvas creation and edge-edit guards in ArchitectureContext; filtered protocol/API choices
  and derived transport in ServiceInspector; Analyze findings and live traversal checks.
  New request pairs without contracts are rejected; invalid imported interactions fail with 400,
  unknown runtime interactions with 501. Gateway HTTP/HTTPS denotes forwarding; SQL cannot
  target an IGW/S3. Tests: `test/connection-contracts.test.ts` plus UI integration.
  Read `docs/features/CONNECTION_CONTRACTS.md` before extending contracts. Low-level simulator
  compatibility mode remains when enforceIam is false; the UI/live labs use strict mode.
  Unexecuted legacy dependency arrows and structural annotations are not fully modeled.

- **CloudWatch / CloudTrail / SQS / SNS bounded behavior** — implemented and verified.
  Shared pure engine: `src/engine/services/operations.ts`; live adapter:
  `src/engine/simulation/adapters/managedServices.ts`; inspector: `ManagedServicePanel.tsx`.
  Live results carry serviceStates; context persists those to customConfig.serviceRuntime,
  so drafts retain queue/alarm/audit state. SQS visibility/receipt lifecycle, SNS fanout to
  permitted queues, single-period CloudWatch alarms with SNS actions, and CloudTrail event
  selection/connected messaging audit are supported. Tests: `test/managed-services.test.ts`
  plus UI draft persistence. Read `docs/features/MANAGED_SERVICE_BEHAVIOR.md` for limitations.
  Inspector operations are administrative experiments, not authorized application API calls.

- **Named drafts** — done: implemented, tested (`test/releases.test.ts`,
  `test/ui/ui-integration.test.ts`), documented (`docs/features/DRAFTS.md`).
- **Subnet NACL rule-set presets** — done: implemented
  (`src/engine/network/naclPreset.ts`, rewritten `NaclSideColumn.tsx`,
  `ServiceInspector.tsx`), tested (`test/nacl-preset.test.ts` + UI test),
  documented (`docs/features/SUBNET_NACL_PRESETS.md`).
- **EC2 → S3 IAM role panel** — implementation retained, now has dedicated authorization
  tests (`test/ec2-iam-role.test.ts`) and documentation (`docs/features/EC2_IAM_ROLE.md`).
  Read/list optional write, EC2 trust mapping, bucket scoping and detach are covered.
- **Per-relationship-kind connection line styling** — done, no dedicated test:
  `CustomConnectionEdge.tsx` now gives each `RelationshipKind` (request/
  dependency/manages/route-association/target-registration) a distinct static
  dash pattern (solid/dashed/dotted/dash-dot/fine-dots), independent of the
  existing simulation-status color/animation overlay. `npx tsc --noEmit` and
  `npm test` (420/420) pass. No new automated test asserts the exact dash
  values — only manually verified + covered incidentally by existing UI
  tests not breaking. Documented in `USER_MANUAL.md` §4, not in
  `docs/features/*.md` (this is a rendering/UX change, not a new
  behavioral capability, so it didn't seem to warrant one — reconsider if
  that's wrong).
- **Protocol/interaction compatibility check** — done, implemented + tested + documented:
  `src/engine/validation/protocol.ts` (new), wired into `validateArchitecture`
  (`src/engine/validation/index.ts`), surfaced in Analyze → Configuration Validity. Reuses
  `AWSService.inputs` from `serviceCatalog.ts` rather than a new table. Fixed real catalog gaps
  found along the way (CloudFormation/Fargate/NAT Gateway/Cloud Map `inputs`) and confirmed one
  reference architecture's protocol "mismatch" (NACL vs Security Group demo) is intentional, not
  a bug — do not "fix" that one. Tests: `test/validation-engine.test.ts` #12-16b. Doc:
  `docs/features/PROTOCOL_COMPATIBILITY_CHECK.md`. 426/426 tests pass, `tsc --noEmit` clean.
- **Problem 3.1 banner false-trigger fix** — done, tested, documented: the canvas's "Architectural
  Diagram addressing problem 3.1" banner (`ArchitectureCanvas.tsx`) used to key off `hasCustomNacl`
  (any subnet has a NACL at all), so it started appearing every time a user used the unrelated
  "Enable NACL rule set" preset feature above. Added a narrower `hasMissingReturnNacl` derived
  value (`ArchitectureContext.tsx`) that only reflects the actual missing-ephemeral-return
  condition Problem 3.1 diagnoses; the banner now uses that instead. `hasCustomNacl` itself is
  untouched (still correctly gates the "NACL Details" button for any custom NACL). Test:
  `test/ui/ui-integration.test.ts` ("hasMissingReturnNacl..."). Doc updated:
  `docs/features/SUBNET_NACL_PRESETS.md`. 427/427 tests pass, `tsc --noEmit` clean.
- **Regional pricing toggle** — done, implemented + tested + documented:
  `src/engine/cost/costCalculator.ts` gained `CostRegion` ('us-east-1'/'eu-west-1'/'ap-south-1'),
  `COST_REGIONS`/`REGION_LABELS` (UI labels stay continent-level - "United States"/"Europe"/"Asia
  Pacific" - never a specific city, per the request), and `REGION_MULTIPLIERS` (a blended
  per-category premium: compute/storage/database/networking). `calculateNodeCost` and
  `calculateArchitectureCost` take an optional `region` param; `route53` and `eks` are exempt
  (genuinely flat-rate globally in real AWS). Wired into `CostEstimatorModal.tsx` as a local toggle
  (same pattern as the existing traffic-load override - not global context state, resets on
  reopen). This is a blended approximation, not live per-SKU AWS pricing - documented as such
  everywhere it's mentioned. Tests: `test/engine.test.ts` #36c-36e. Doc:
  `docs/features/REGIONAL_PRICING.md`. 430/430 tests pass, `tsc --noEmit` and `npm run build`
  clean. UI not visually verified in a browser (no screenshot/browser tool available this
  session) - worth a manual check of the modal's new region toggle row before considering this
  fully done per this project's own UI-verification standard.
- **ECS cluster connectivity map (v5, task-pool markers)** — done, implemented + tested +
  documented: added a small "routed to these tasks" marker directly above a targeted service's
  task-squares row (and "these tasks call out" below it, for outbound), in response to "is it
  possible to show lines pointing to the task?" Deliberately does NOT point at one specific task
  square - the model has no per-task identity, only an aggregate running/desired count per
  service, so a line to one particular square would fabricate data that doesn't exist; pointing at
  the whole row is the honest version (an ALB target group genuinely routes to whichever
  registered tasks are healthy, not one fixed task). Computed via two new `Set`s
  (`servicesWithInbound`/`servicesWithOutbound`) built alongside the existing inbound/outbound
  grouping. Tests: `test/ui/ui-integration.test.ts`, same "ECS connectivity map..." test, extended
  to assert both markers appear exactly where expected (API service has both; Worker service only
  the inbound one) and that the boundary-crossing-arrow count assertion still excludes these new
  in-box markers. Doc: `docs/features/ECS_CONNECTIVITY_MAP.md`. 432/432 tests pass, `tsc --noEmit`
  and `npm run build` clean.
- **ECS cluster connectivity map (v4, cluster-boundary correctness fix)** — done, implemented +
  tested + documented: `src/components/ecs/EcsConnectivityMap.tsx` lives at the top of
  `EcsExplorer.tsx`'s right-hand sidebar. A dedicated `aria-label="Cluster boundary"` box contains
  *only* the cluster's own service boxes (icon+name, live task-state squares colored by health -
  emerald/amber/rose matching `NodeStatusModal.tsx`'s existing palette, dashed square =
  desired-but-not-running, container count/names). External components (ALB, RDS, etc.) render
  strictly **outside** that boundary - inbound above with an arrow into it, outbound below with an
  arrow out of it - since a cluster is a logical grouping of services and a load balancer/database
  is a separate resource, not part of it. v3 had nested the ALB's box inside the same bordered
  container as the cluster label, visually implying it was part of the cluster - the user caught
  this by asking "should ALB be outside of the cluster in the diagram?" (correct AWS answer: yes).
  Also deduplicated in the same pass: an external node fanning out to several cluster services
  (e.g. one ALB) is now drawn once with a caption naming every service it reaches, not once per
  service. Intra-cluster edges still excluded from the boundary-crossing boxes and reported as a
  count. Updates live as task counts/health/connections change - no reopen needed.
  **Real bug found + fixed while building the v3 sidebar redesign**: `addServiceNode`/
  `addBoundaryNode`/`onConnect`/duplicate-node all generated ids from `Date.now()` alone,
  colliding whenever two same-kind nodes/edges were created in the same millisecond (second one
  silently clobbers the first instead of adding a new one). Fixed with a module-level monotonic
  counter (`uniqueId()` in `ArchitectureContext.tsx`) at all four call sites - a correctness fix
  independent of this feature, worth knowing about if anything upstream depended on the old id
  format (nothing did, checked). Tests: `test/ui/ui-integration.test.ts` ("ECS connectivity
  map..." x2, updated for the boundary/dedup correctness assertions). Doc:
  `docs/features/ECS_CONNECTIVITY_MAP.md`. 432/432 tests pass, `tsc --noEmit` and `npm run build`
  clean. UI not visually verified in a browser (no screenshot/browser tool available this
  session) - the user was screenshotting a stale deployed preview pinned to an old commit hash
  earlier in this thread, not this local working tree; a fresh screenshot request may need to
  point at `npm run dev` instead.
- **`USER_MANUAL.md`** (new, repo root) — end-user guide (students/
  instructors): modes, building architectures, connection meaning vs. line
  style vs. Coupling Mode, running simulations, Failure Lab, Analyze, cost
  estimator, drafts/labs/reference diagrams, export. Linked from README.md.
  This is distinct from `docs/features/*.md` (dev-facing, one file per
  behavioral feature) and from this HANDOFF.md (agent-facing state) — don't
  conflate the three when updating docs going forward.

### Known gaps

- ASG controller is simple scale-out only, explicit period samples, one blueprint subnet and
  dedicated alarm per group. No auto CPU metrics, scale-in, replacement, full health checks,
  ECS scheduling, full AWS target-tracking controller, SNS alarm fanout or scaling IAM. Boundary expansion survives
  reset. Play is inspector-local and stops on unmount. Runtime persists, wall-clock playback does not.

- ECS host identities, shared capacity-provider/ASG configuration, actual task placement,
  resource scheduling, and lifecycle timing remain unmodeled. No live EC2 Auto Scaling simulation.

- Connection contracts cover a curated subset, not all AWS services or possible integrations.
  Full listener/port capabilities, structural contracts and operation catalogs remain incomplete.
  Transport is separated for new connections; legacy educational protocol labels are preserved.

- New service behavior is deliberately partial. No FIFO/DLQ/redrive, automatic consumers,
  delivery retry scheduling, CloudWatch logs/multi-period alarms, or CloudTrail S3 delivery.
  SNS queue policy is an educational topic-ID allow-list, not full IAM policy evaluation.
- CloudWatch samples are explicit inputs; other services do not automatically produce CPU metrics.
- The standalone service model registry still contains older messaging/CloudWatch models;
  the new shared operation engine is wired through the live adapter. Do not claim parity.
- No browser screenshot verification performed. Manually inspect new service inspector controls.
- Existing networking/IAM deviations remain; refer to target architecture and feature docs.

### Next steps

- For ASG expansion, start with documented health-check outcomes and subnet/launch-template
  resource modeling, then scale-in/termination and capacity-provider scheduling if requested.

- If live ECS capacity simulation is requested, introduce explicit cluster capacity pools
  and host/task identities before adding capacity lifecycle visualization.

- Extend contracts with documented source/destination behavior, listener/port requirements and
  structural relationship semantics; migrate remaining low-level compatibility callers only
  after updating their behavioral assumptions. Do not silently mark unknown behavior valid.

- Review the managed-service inspector on the running app and use the documented workflows.
- Add remaining AWS semantics incrementally with documented conformance scenarios, starting
  with service-model consolidation and queue redrive/consumer lifecycle if requested.
- No changes have been committed or deployed by this session.

## Service simulation capability registry

A registry exists under `src/engine/capability/`. The previous statement that none existed was
stale. Live evidence entries now include bounded CloudWatch, CloudTrail and SNS operations;
this does not mean those services have FULL_BEHAVIOR support.
