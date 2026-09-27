# Numbered connection priority

Set **Sequence Step Number (Simulation Priority)** in the connection inspector. At each resource,
positive integer step numbers take priority from lowest to highest. Unnumbered connections follow;
ties retain existing target/connection order. Invalid numbers are treated as unnumbered. Without
numbers on a resource's outgoing request connections, its existing selection behavior is unchanged.

This selects a path through the graph; it is not a global instruction list that teleports between
unconnected resources or executes every branch. Existing dependency calls retain their semantics;
numbered dependency edges are ordered within their own execution phase. Return and structural
arrows do not become requests merely because they carry numbers. SNS retains fanout behavior.

Managed-service, data-tier and endpoint adapters defer when another numbered destination has
priority. Load balancers keep healthy-target selection/failover using numbered preference.
Routing, IAM, service health and connection-contract checks remain active. A number does not
make an invalid interaction legal. Step labels remain displayed as before and persist in drafts.

The DIT reference's admin-browser edge now explicitly targets its API Gateway at step 4 rather
than entering a shared client node whose lower-numbered branch leads to the portal. This preserves
the reference's intended admin destination under the new numbering behavior.

Tests: `test/connection-order.test.ts` covers deterministic stable ordering, unchanged unnumbered
behavior, live branch selection, adapter precedence and healthy-target failover. Full suite:
450 passing tests; production build passes.
