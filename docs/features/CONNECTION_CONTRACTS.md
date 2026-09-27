# Enforced connection contracts

The canvas, connection inspector, Analyze compatibility findings and live request traversal now
share `engine/architecture/connectionContracts.ts`. This is a curated interaction model, not an
inference that every icon supports everything listed in catalog prose.

- Drawing selects a supported default interaction or rejects unsupported/unmodeled pairs with
  an explanation. This does not provision routes, IAM policies, listeners or subscriptions.
- Editing an invalid protocol/action/transport is rejected. The inspector shows supported
  protocols and API actions, a derived transport, and the contract explanation. Existing invalid
  imported values remain visible so they can be corrected.
- Protocol is retained as the legacy educational interaction label. New edges separately store
  transport; API operations use the existing action field. Changing interaction updates transport.
- Live execution checks forwarding connections and the currently executed DynamoDB dependency
  branch before executing a hop. Invalid interactions fail with 400; unknown contracts report 501.
  This also catches imported JSON and later changes to resource types. isCriticalDependency=false
  does not bypass the live check. Structural/return arrows do not carry application requests.
- Gateway HTTP/HTTPS labels mean forwarded traffic, not gateway API calls. SQL/S3 operations
  cannot target an IGW. Gateways cannot terminate application execution without a destination.
- Missing routes/permissions remain runtime failures for otherwise valid interactions.

Coverage is explicit in the contract table: core compute, databases, S3, gateways/endpoints,
load balancers, ingress, messaging and monitoring. Unknown new request pairs cannot be drawn.
Structural relationships remain annotations; their execution is not implemented. Unexecuted
legacy dependency arrows remain outside the live validator (existing scope notice applies).
Low-level runSimulation calls without enforceIam retain compatibility mode for historical
engine/reference tests; the application's runLiveSimulation and runtime lab flows enable strict
validation. Configuration-only and IAM-only labs have their own non-request evaluation paths.

This is not a universal proof of AWS legality. Listener/application capabilities, custom ports,
all source-side service integrations, subscription protocols, complete operation catalogs and
structural relationship contracts need further expansion. Accepted contracts still require
network, policy and configuration evaluation; standalone transport does not prove reachability.
The API operation selector does not add service functionality beyond existing adapters.

Sources:
- https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html
- https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html

Tests: test/connection-contracts.test.ts plus UI integration. Cases cover SQL→S3/IGW rejection,
valid gateway web forwarding, mismatched operations/transports, missing resources, unknown
services, imports marked noncritical, default selection and rejected inspector edits.
