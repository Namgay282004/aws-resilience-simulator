# DSO303 Labs

The top navigation now opens Labs instead of Challenges. Existing challenge data and evaluation code remain intact.

The catalog follows the course links in the [course lab index](https://norbutlepcha25.github.io/dso303/Lab/overview.html). All Labs 1–13 are present. Links and titles follow the current course navigation, including Lab-02-VPC.html and Lab-03-EC2.html.

| Lab | Reference simulations | Scope |
| --- | --- | --- |
| 1: IAM foundation | Scoped S3 access; explicit deny | Effective policy evaluation |
| 2: VPC | Private S3 endpoint request | Network reference; EC2/S3 probes are teaching aids |
| 3: EC2/VPC | Web to database-tier EC2; SG denial | Connectivity, not database execution |
| 4: ECS | Web to private Fargate tasks | Running-task availability and SGs |
| 5: ALB | Healthy request; task A failure | Selection of surviving task B |
| 6: Auto Scaling | Two-task and four-task snapshots | Supplied capacity, not automatic scaling |
| 7: EKS | Enrolment path; results path; unavailable enrolment | Internal workload abstractions, not Kubernetes DNS or scheduling |
| 8: EKS scaling | Two/four replica snapshots; unavailable workload | Fixed worker count; no HPA, Ingress or node scaling execution |
| 9: Security | ALB-only ingress; rejected bypass; read-only IAM allow/deny | Selected SG and identity-policy decisions |
| 10: Lambda/edge | Edge/regional topology; invalid $LATEST | Bounded configuration checks, no function execution |
| 11: CI/CD | Versioned source/build artifacts; disabled versioning | Configuration checks, no build execution |
| 12: ECS deployment | Deploy artifact contract; wrong container; running service | Configuration checks plus a separate ALB/ECS runtime snapshot |
| 13: Monitoring | Logs/metrics/alarms/traces; wrong missing-data treatment | Course configuration checks, no telemetry or alarm evaluation |

Each lab links to its original instructions and lists unsupported operations. These references supplement the course; they do not execute CLI commands, create AWS resources, run Docker, reproduce Floci, or demonstrate the full AWS service lifecycle. Route-table nodes are annotated references, not proof of full route-selection fidelity. IAM runs do not claim network connectivity or S3 object execution. Their latency is zero because the policy evaluator does not model API latency.

## Student workflow

1. Open Labs and choose a lab.
2. Open the original instructions for the complete exercise.
3. Load a reference to edit its canvas, or run a reference to see its recorded decisions and flow.
4. For network labs, edit configuration and use Send Request or Failure Lab to explore consequences.

Loading or running a reference replaces the current canvas and clears previous simulation/failure state. Running a reference always uses the supplied snapshot. The canvas refits when a reference is loaded. The run control retains the selected reference's evidence type:

- **Send Request** runs network references against the edited canvas.
- **Evaluate Policy** evaluates the supplied IAM policy input, including after reloading a reference.
- **Check Configuration** evaluates the current nodes and relationships against the listed course requirements. Select a service, open **Config → Lab configuration**, edit the JSON settings and apply them before rechecking. S3 versioning can also be changed with its normal inspector toggle.

Configuration traces have zero latency and an empty request path. Their PASS/FAIL
status is not an HTTP response or proof that AWS accepted or executed a deployment.
Dashed pipeline/monitoring relationships describe artifacts, associations or telemetry.
Loading a normal architecture template or clearing the canvas exits lab evaluation.

## Add a future lab

Lab reference snapshots (`LabReference`: nodes/edges/scenario, optional `configurationChecks`,
optional `authorization`) live as individual JSON files in `src/data/labs/` - not written inline
in TypeScript. To add or edit one: download an existing reference from the Labs modal (small
download icon on any reference card) as a starting point, edit the JSON, place it in
`src/data/labs/` (keeping its `id` unique), then run `npm run labs:sync` (or just `npm run dev`/
`npm run build`/`npm test` - the catalogue regenerates automatically first). See
`src/data/labs/README.md` for the full workflow. There is no in-app upload for lab references -
placing the file is the only path to a permanent change, since a lab reference can carry
configuration checks and IAM authorization data that need reviewing, not blind re-uploading.

Course-lab metadata (which labs exist, objectives, source URL, limitations, and which reference
IDs belong to which lab) is separate, hand-maintained data in `src/data/courseLabsMeta.json` - add
an entry there (with a stable `id`, course `number`, `sourceUrl`, `objectives`, `limitations`, and
the `referenceIds` of the JSON files that belong to it) when adding a new lab rather than just a
new reference to an existing one. Reference service IDs must exist in the catalog; edges must
resolve to nodes. Add expected outcomes to `test/course-labs.test.ts` and verify them against the
existing engines. Do not add AWS semantics to `LabsModal`.

`src/data/courseLabShared.ts` holds the shared `LabReference`/`CourseLab`/`LabConfigurationCheck`
types (no builder functions - those were retired once every lab reference they produced was
captured as a JSON snapshot; `npm test` passing unchanged, 469/469 at migration time, was the
verification that nothing was lost). `src/data/labsRegistry.ts` is generated from the JSON folder
by `scripts/generate-labs.mjs`; `src/data/courseLabs.ts` assembles the runtime `COURSE_LABS` array
by looking up each lab's `referenceIds` against that registry, throwing at import time if a
referenced id has no matching file. `src/engine/labs/runLabReference.ts` delegates network
scenarios to the live simulator, IAM scenarios to the policy evaluator, and configuration
references to `checkLabConfiguration.ts`. Checks read actual node settings/relationships and
record inputs, decisions and rule sources; they are course assertions, not a general AWS
configuration validator. Context owns canvas replacement and playback. Reference snapshots are
cloned before editing so student edits cannot alter another student's starting example.

Validation covers all 29 reference outcomes, deterministic/immutable runs, graph identities, configuration mutation failures, missing resources/relationships, SG denial and target failover. UI integration covers Labs 9–13, current-canvas rechecks, retained IAM evaluation, and returning to ordinary simulation.

## Reference layout checks

Network labs share fixed rows for the VPC gateway, public subnets, private
subnets, and route tables/gateway endpoint. Subnet labels show their AZ.
Routing resources stay inside the VPC with space for their complete labels;
workloads stay fully inside their intended subnet. Security groups and supporting
services use separate columns on the right. The ALB label identifies both public
subnets; its single icon remains an aggregate multi-AZ resource. EBS is shown as
an attached supporting resource with its AZ, not as a network hop.

Layout regression tests reserve 140×140 pixels per service, including wrapped
labels and notes, with at least 16 pixels of clearance. They verify full subnet
and VPC containment, consistent subnet/AZ assignments, and service-card spacing
for every reference, including failure/capacity variants. These are conservative
geometry checks, not a browser screenshot assertion.

Behavior checks retain all 16 deterministic reference outcomes and additionally
exercise NAT failure with the S3 gateway endpoint, unavailable ECS targets, and
ALB-to-task security-group denial. Gateway endpoint independence from NAT follows
[the AWS gateway endpoint documentation](https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html).
The public/private tier placement follows
[AWS's VPC example](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-example-private-subnets-nat.html).
The course's single NAT remains a resilience limitation; these edits do not claim
full route-table execution, Kubernetes scheduling, or automatic scaling support.

## Bounded rules and remaining deviations

- Lab 9 runs the existing SG/IAM evaluators. The complete IAM trust, boundary,
  PassRole, session, IMDSv2 and credential-rotation exercises remain in the course.
- Lab 10 checks selected [Lambda@Edge restrictions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-edge-function-restrictions.html)
  and [S3 notification region requirements](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html).
  Declared trust-principal checks do not evaluate a complete trust policy. OAC,
  origin authorization, handler code and Lambda invocation policies remain unchecked.
- Lab 11 checks the [versioned S3 source requirement](https://docs.aws.amazon.com/codepipeline/latest/userguide/action-reference-S3.html)
  and the course's [buildspec configuration](https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html).
  Selecting buildspec.yml does not prove the file exists or that its commands work.
- Lab 12 checks the course image artifact against the ECS container name using the
  [image definitions contract](https://docs.aws.amazon.com/codepipeline/latest/userguide/file-reference.html).
  The connected ECS topology is a supplied snapshot; the build, image push/pull,
  deployment, task registration and rollback are not executed.
- Lab 13 checks course retention, filter declarations, tracing and alarm settings
  against the [monitoring exercise](https://norbutlepcha25.github.io/dso303/Lab/Lab-13-monitoring.html).
  It does not ingest logs, evaluate metric windows, change alarm states or deliver
  notifications. SNS actions belong to a later course exercise.
- Lab 3 still uses the existing SQL abstraction rather than a PostgreSQL packet
  model: port 5432 is not verified. Full route tables, EKS scheduling and automatic
  scaling also remain outside these references' supported behavior.

These checks deliberately distinguish AWS requirements from exact values chosen
by the course (such as 14-day retention or the r7 image tag). A configuration FAIL
means a stated check failed; it is not a general claim that the configuration is
invalid for every AWS use case. Geometry checks reserve label space; visual browser
inspection remains a separate verification step.

Managed/global reference services do not inherit AZ-A from the node builder.
Only subnet-placed workloads and the explicitly zonal EBS example do, so a
customer AZ-A failure no longer marks unrelated S3/Lambda/IAM references failed.
The existing UI groups non-customer-AZ placement under “Edge / Global”; this does
not imply that every managed service has global scope.
