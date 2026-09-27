# Behavioral foundation: incremental migration

## Reference library and Export workflow (2026-09-24)

Reference Diagrams is now on the canvas. Fourteen built-ins are individual JSON files in
`src/data/references/`, with a generated registry and compatible existing import API.
Save as reference exports the same source-compatible format; the user copies it into the
folder manually, then restarts dev or builds. Draft export remains a separate full-workspace
format. Export now uses a light dialog with file and browser-draft sections.
Validation: 469 tests and production build pass. See `src/data/references/README.md`.

## Latest increment: CloudWatch / ASG scale-out (2026-09-24)

Implemented an explicit, persisted ASG scale-out controller with consecutive CloudWatch
samples, simple-policy cooldown, startup/warmup, generated EC2 nodes and ALB/NLB readiness.
Canvas Send Request now drives ALB request-count observations automatically. CloudWatch’s
Config panel selects simple or illustrative target tracking. Reference diagram:
**CloudWatch → ASG: Live EC2 Scale-Out**. See
[ASG_SCALING.md](../features/ASG_SCALING.md) for configuration, tests and precise limitations.
This is bounded scale-out support, not full Auto Scaling/ECS scheduling fidelity.

## Implemented increment

The existing live request simulator remains the execution entry point. This increment adds
shared, React-independent rules instead of introducing another competing simulator.

- `engine/architecture/relationships.ts`: explicit request, dependency, management,
  route-association and target-registration semantics. Existing edges retain their meaning.
  Explicit meaning overrides legacy `traversal`. Live traversal excludes structural edges
  and response arrows; the inspector exposes this setting. Structural control-plane effects
  are not implemented and live results disclose that limitation.
- `engine/network/vpcEndpoint.ts`: selected endpoint service, gateway validation, health
  and destination matching. Existing S3 endpoint nodes default to S3. Interface endpoints
  require `customConfig.endpointService` (a simulator service ID).
- Live explicit endpoint hops reject destination mismatches. Implicit S3 endpoint discovery
  no longer accepts an endpoint for another service. Terminal endpoints fail with an explanation.
- Service-model configuration validation uses the same rules. The endpoint inspector exposes
  service configuration and model limitations.
- Regression coverage includes legacy relationship compatibility, live structural-edge
  exclusion, endpoint service mismatch, invalid gateway service, unavailable endpoint and
  terminal endpoint rejection.

AWS sources:
https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html
https://docs.aws.amazon.com/vpc/latest/privatelink/create-interface-endpoint.html

## Remaining limitations

This is not a full networking migration. Implicit endpoint discovery still uses architecture-wide
presence rather than actual route-table associations. Interface service availability by region,
private DNS, endpoint policies and prefix lists remain unimplemented. Some specialized live
adapters bypass generic network routing (notably database/dependency handling); these require
conformance coverage before migration. Structural relationships are currently annotations for
execution, not functional resource controllers or input to all legacy analysis engines.

Visual subnet containment, placeholder IPs and legacy firewall approximations remain.
Do not interpret passing endpoint service matching as proof of AWS reachability or permission.

## Next priorities and completion gates

1. Explicit network identity: VPC/subnet/ENI and route-table IDs with validated references.
   Migrate old diagrams deterministically; test movement, import/export and stale references.
2. Shared route resolution on every relevant live request branch. Test same-VPC local routing,
   longest-prefix selection, cross-VPC isolation, NAT egress and endpoint route association.
3. Packet-based SG/NACL evaluation and return paths. Test ports, CIDRs, SG references,
   statefulness and ordered stateless rules against official AWS behavior.
4. Unify authorization and service execution behind existing live adapter seams. Route each
   supported service through one authoritative implementation; expose unsupported capabilities.
5. ASG/lifecycle controllers with an injected clock and seeded deterministic scheduling.
   Management edges must govern instance membership rather than accept requests.
6. Failure and challenge evaluation reuse the same model and decisions. Test NAT failure
   affects internet egress but does not break local private traffic.

Every increment needs conformance fixtures, existing lab regressions, structured explanations,
explicit deviations and successful type/build checks. Do not mark these remaining stages complete
just because the application builds.

## Priority 1 progress: explicit subnet references

Implemented optional `networkIdentity` fields for subnet, VPC and route-table IDs.
The service inspector supports explicit subnet selection, with legacy geometry as the default.
Explicit subnet membership survives movement and JSON serialization. Shared containment lookup,
context subnet classification and live firewall checks use the assigned subnet. Missing or wrong-type
references and resource/subnet VPC mismatches produce configuration findings; live simulation
rejects invalid explicit identities before execution. Legacy diagrams remain unchanged.

Verified against AWS subnet concepts:
https://docs.aws.amazon.com/vpc/latest/userguide/configure-subnets.html

Priority 1 remains in progress: no ENI allocation, automatic migration of all diagrams,
route-table enforcement, or complete multi-subnet service model is claimed. VPC/route-table fields
currently support programmatic/imported configuration; subnet selection is exposed in the inspector.
The public/private label still uses the boundary type rather than actual route contents.
Regression tests cover movement, JSON roundtrip, legacy compatibility, stale references,
wrong resource types and VPC mismatch. Existing labs and UI regression tests are retained.

## Priority 2 progress: explicit live local routing

`network/liveRouting.ts` reuses longest-prefix selection from the existing route engine.
Live branches invoking the shared firewall gate now evaluate explicit routes first, including
compute-to-database and load-balancer target checks. Missing routes deny requests; malformed
routes produce configuration errors; unsupported transit or missing destination addresses return
an explicit unsupported result (501), rather than inferred connectivity.

Configure a Route Table node through its JSON configuration editor:

```json
{
  "routeTable": {
    "routes": [
      { "destinationCidr": "10.0.0.0/16", "target": { "type": "local" } }
    ]
  }
}
```

Associate its node ID via subnet `networkIdentity.routeTableId` in imported configuration,
or use the resource inspector's explicit route-table override. The latter is a simulation
convenience, not an AWS per-resource association. Set destination `networkIdentity.privateIp`
in the inspector. Destination subnet CIDR and both VPC memberships must resolve. Legacy
unassociated diagrams keep their previous execution behavior.

Verified cases: local route outranks a NAT default, missing route denies a live database request,
local route cannot cross VPCs with overlapping CIDRs, malformed routes fail closed, unsupported
transit is disclosed. AWS source:
https://docs.aws.amazon.com/vpc/latest/userguide/route-tables-priority.html

Remaining: transit execution (NAT/IGW/endpoints/peering/TGW), DNS/address allocation, return-route
checks, reserved/duplicate IP validation, main route-table defaults, and adapters bypassing the
shared gate. Consequently priority 2 is still in progress. No complete networking fidelity is claimed.
