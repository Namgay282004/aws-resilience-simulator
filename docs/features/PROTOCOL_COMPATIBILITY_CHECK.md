# Protocol / interaction compatibility check

Every connection lets you pick a Protocol / Interaction label independently of the two services
it joins - nothing previously stopped picking `SQL` into an S3 bucket or `DNS` into an RDS
instance. `validateArchitecture` (`src/engine/validation/index.ts`) now includes
`validateProtocolCompatibility` (`src/engine/validation/protocol.ts`), which flags a connection
whose protocol doesn't match its target's modeled inbound protocol(s), surfaced in Analyze ->
Configuration Validity like any other structural finding (resource, problem, why it matters, the
rule it's grounded in, a recommendation).

The check reuses `AWSService.inputs` from `src/data/serviceCatalog.ts` - already-curated,
per-service data (RDS: `['SQL']`, SQS: `['Message']`, S3: `['HTTPS', 'Object access']`, etc.) -
rather than a second compatibility table. A target with no curated `inputs` (empty/default) is
left unflagged: the catalog makes no claim, so the check says nothing, rather than guessing.

Deliberate exemptions, so it doesn't fight the rest of the app:

- **Non-request relationship kinds** (`manages`, `route-association`, `target-registration`) are
  skipped - protocol only means something on `request`/`dependency` edges.
- **`isCriticalDependency: false` edges** are skipped - these already mean "configuration,
  telemetry, or artifact flow, not live traffic" (see the "AWS Data Transfer Hub" reference
  architecture's CI/CD pipeline edges in `referenceArchitectures.ts`: ECR image pulls, S3-hosted
  CloudFormation templates, pipeline-triggered stack updates - this doc previously misattributed
  these to `courseLabsAdvanced.ts`, which has since been retired anyway; see `docs/COURSE_LABS.md`
  for how lab references are stored now).
- **Free-text protocol labels outside the `ProtocolType` union** (e.g. `"Replication"` for RDS
  Multi-AZ sync, `"S3 API"` for a VPC Gateway Endpoint hop) are a deliberate escape hatch some
  reference diagrams use for a mechanism the 9 standard categories don't capture, and are exempt.

`protocol` here is this simulator's own educational abstraction (`ProtocolType`), not a literal
AWS wire protocol - a finding means "this label doesn't match how this service is modeled to
communicate," not "AWS would refuse this packet." Phrasing in the finding is written accordingly.

Building this surfaced two real issues, now fixed:
- `AWS CloudFormation`, `AWS Fargate`, `NAT Gateway`, and `AWS Cloud Map` had default/incomplete
  `inputs` in the catalog that didn't reflect real access patterns (pipeline-triggered stack
  updates, ECR image pulls over HTTPS, NAT's protocol-agnostic passthrough, DNS/SRV lookups) -
  curated in `serviceCatalog.ts`.
- The `"Network ACL vs Security Group in Action"` reference diagram's App Server -> RDS edge is
  intentionally labeled `HTTPS` (not `SQL`) - that mismatch is the entire lesson (the subnet NACL
  only denies TCP and lets it through; the database's Security Group only allows SQL and correctly
  blocks it). The check is expected to flag it, and a test asserts that it still does.

Validation: mismatch is flagged; a matching protocol is not; an uncurated target is not; the three
exemption categories above are not; every reference architecture is checked for zero *unexpected*
protocol findings, with the one intentional exception named explicitly. Full suite: 426 tests
passed (`test/validation-engine.test.ts`, tests 12-16b).
