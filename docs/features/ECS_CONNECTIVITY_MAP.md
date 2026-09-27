# ECS cluster connectivity map

The ECS Explorer (`EcsExplorer.tsx`) has a live cluster status widget (`EcsConnectivityMap.tsx`)
at the top of the right-hand detail sidebar, above the per-component configuration fields. It
updates immediately as task counts, health, or connections change - no separate refresh or reopen
needed.

## Cluster boundary is real, not decorative

An ECS cluster is a logical grouping of services/tasks - a load balancer, database, or anything
else it talks to is a separate AWS resource, never part of the cluster. The diagram enforces this:
a dedicated `aria-label="Cluster boundary"` box contains only the cluster's own service boxes.
External components (e.g. an ALB, a database) always render **outside** that box - above it for
inbound connections, below it for outbound - connected by an arrow crossing the boundary, never
nested inside it. An earlier version nested the ALB's box inside the same bordered container as
the cluster label, which visually implied the ALB was part of the cluster; this was corrected on
review.

An external node connected to *several* services in the cluster (e.g. one ALB fanning out) is a
single real AWS resource, so it's drawn **once**, with a caption naming every service it reaches
(e.g. "→ API service, Worker service") rather than being duplicated once per service it happens to
target.

## Inside the boundary: per-service live state

Each service renders as its own box (icon + name). Clicking a service's name/icon jumps straight to
its Network section in the sidebar below, same as clicking it in the main topology diagram. Each
box shows:

- **Task squares** - one small square per running task, colored by that service's health
  (`healthy` -> emerald, `degraded` -> amber, `failed` -> rose - the same palette
  `NodeStatusModal.tsx` already uses, not a new one invented for this). A dashed-outline square
  marks a task that's desired but not yet running (`desiredCount - runningCount`, clamped to zero
  when running exceeds desired - see below). The model tracks health per service, not per
  individual task, so every square for a service shares that service's color - this doesn't
  fabricate per-task health data that doesn't exist. Capped at 24 squares with a "+N" suffix for
  very large counts, matching the existing cap-then-"+N more" pattern already used in
  `EcsTopology.tsx`.
- **Container count/names** - from the same saved container definitions `EcsTopology` shows.

An edge between two services *inside* the same cluster is neither inbound nor outbound for the
cluster as a whole, so it's excluded from the boundary-crossing boxes and reported as a one-line
count instead, so it isn't silently dropped.

A service that's actually the target of an inbound connection gets a small "routed to these tasks"
marker directly above its task-squares row (and "these tasks call out" below it, for outbound) -
pointing at the task pool specifically rather than stopping at the service's name/icon row. This
doesn't point at one specific task square: the model has no per-task identity, only an aggregate
running/desired count per service, so a line to one particular square would be fabricating data
that doesn't exist. Pointing at the whole row is the honest version of "which task does the ALB
route to" - the pool, not a specific instance - matching how an ALB target group actually works
(it routes to whichever registered tasks are healthy, not one fixed task).

`runningCount` can legitimately exceed `desiredCount` in real ECS (a rolling deployment briefly
over-provisions before draining old tasks; scaling down leaves tasks running until they finish
draining) - nothing in the model or this widget blocks or flags that as invalid, and it renders
correctly (more filled squares than desired, zero dashed gap squares, no negative counts).

This is a connectivity and status **overview**, not a request-simulation result: boxes show that a
configured link exists, not that a request would succeed across it - the same caveat every other
canvas-connection view in this app already carries.

## History

This moved out of the main canvas column (an earlier version lived there as a wider left-to-right
diagram with SVG connector lines) into the sidebar per a follow-up request, then had its original
icon-box-and-arrow visual language restored (a version in between had replaced it with plain text
chips) combined with the live task-state squares, then had the cluster-boundary/dedup correctness
fix described above.

**Bug found and fixed while building this**: `addServiceNode`/`addBoundaryNode`/`onConnect`/
duplicate-node IDs were generated from `Date.now()` alone (`node-ecs-<timestamp>`), which collides
whenever two nodes or edges of the same kind are created within the same millisecond - the second
creation would silently overwrite the first instead of adding a new one (surfaced as a React
"duplicate key" warning and two node updates aliasing onto one node). Fixed with a per-session
monotonic counter appended to every generated id (`uniqueId()` in `ArchitectureContext.tsx`),
applied at all four `Date.now()`-based id call sites.

Validation: task squares reflect live running/desired counts and update on the next render when
either changes; square color matches the service's current health and updates when health changes;
an ALB connected to two services in the cluster renders exactly once, outside the cluster boundary,
with a caption naming both services; a service targeted by that ALB shows "routed to these tasks"
and a service calling a downstream dependency shows "these tasks call out," each exactly once per
matching service; an intra-cluster edge is excluded and reported as a count; clicking a service
name opens its Network section; a cluster with no external connections shows an explanatory
message. Full suite: 432 tests passed.
