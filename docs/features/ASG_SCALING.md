# Canvas-driven CloudWatch / ASG scaling

## Demo

Load **CloudWatch → ASG: Live EC2 Scale-Out** from Reference Architectures.
Use **Send Request**, starting at the internal ALB, with **Normal** traffic.
No inspector, overlay, or scaling playback needs to be open.

Each request run models one minute of synthetic traffic. After two normal-load runs,
CloudWatch changes to ALARM and the ASG creates a third EC2 node directly inside the
blueprint's subnet. It has a unique IP, inherited security groups/role, ownership line,
ALB link and Launching badge. Later runs advance startup and warmup. ALB routing excludes
Launching nodes; Warming nodes can serve after assumed successful startup. CloudWatch
and ASG canvas badges show alarm state and desired capacity.

Select **CloudWatch → Config** in the right-hand panel to configure the metric source,
monitored ALB, policy type, threshold/target and consecutive breaching periods:

- **Simple scaling**: fixed positive instance increment, launch/warmup and cooldown guards.
- **Target tracking — illustrative**: desired capacity approximated as
  ceil(requests per target × observed target count / target value), bounded by min/max.
  Optional scale-in requires consecutive below-target samples and completed warmup.
  This does not reproduce AWS's internal target-tracking controller or managed alarms.
- **Step scaling**: non-overlapping breach-offset bands select a nonnegative ChangeInCapacity
  increment. Pending capacity counts toward desired to prevent duplicate launches in warmup.
  The panel exposes two editable bands; the final band is unbounded. Scale-out only.
- **Scheduled scaling**: two editable one-time actions set desired capacity at simulated seconds,
  independent of alarm state or traffic. Use Advance one period or Play scaling in CloudWatch
  Config. A crossed action executes once; reset restarts the clock. These are not UTC/cron schedules.

Policies belong to the ASG; CloudWatch's panel edits the associated policy for convenience.
Policy fields remain editable during a run. Editing a policy pauses playback and resets that group’s generated instances/runtime before applying the change; initial component positions are retained. Threshold/sample changes apply on the next period. Scale-in removes generated nodes and their edges immediately, retaining the initial member count
as a demo floor in addition to min capacity. Scheduled actions enforce the same floor.
No draining delay or AWS termination-policy selection is modeled. The reference enables
target scale-in; older configurations without that flag remain scale-out only.
The demo starts with two EC2 instances, min2/max4, threshold50. Normal traffic is 120/minute,
so the first two samples are 60/target. After the new target is ready, subsequent samples
fall to 40/target. Use High traffic to demonstrate further growth toward max4.

## Metric and clock contract

`engine/scaling/albObservation.ts` observes the actual request traversal result. It requires
an ALB → CloudWatch management/monitoring edge and explicit ASG membership/configuration.
Selecting ALB metric mode in the panel creates the monitoring edge. An unrelated ASG or
nearby resource never implies membership. A blocked request that never reaches the ALB
cannot trigger scaling. Requests routed to another group's target do not produce this group's sample.

One Send Request represents a traced representative request plus a synthetic one-minute batch:
Low30, Normal120, High240, Very-high600, 10×1200, 100×12000 requests. The metric divides
this batch by healthy ready ASG targets registered to the selected ALB. These are teaching
inputs, not individual measured requests, AWS metrics, or inferred CPU utilization.
The result summary and right-hand panel disclose the batch, target count, and metric.
Each explicit run advances one 60-second period; replaying timeline steps does not sample again.
If the ALB reaches target selection but has no ready targets, the controller advances the
lifecycle clock with a missing sample, allowing pending instances to become ready on subsequent runs.

## Persistence and reset

Configuration/runtime remain in existing `customConfig`; drafts preserve nodes, edges,
clock, samples, observations and pending lifecycle. No schema migration is needed.
**Reset scaling** and global request **Reset** remove generated nodes/links and runtime,
retaining original members and configured monitoring edges. Expanded boundary sizes remain.
Manual sample mode remains for old drafts and controlled experiments; its Play/Pause controls
are available in all modes. ALB playback repeats the current request scenario; scheduled playback advances without requests. Faster time starts playback and cycles 1×/2×/5× (one period per 1.5/0.75/0.3 real seconds). Manual playback is inspector-local and is not restored from drafts.

## Limits

One blueprint subnet, explicit initial members, one dedicated alarm per group; maximum20
instances. Blueprint is an existing EC2 configuration, not a versioned AWS Launch Template.
N consecutive samples (1–10); missing data yields INSUFFICIENT_DATA. No raw sample aggregation,
M-of-N alarm logic, automatic CPU metrics, termination of initial diagram members, failed-instance replacement, full health
checks, ECS placement, mixed instance weights, SNS alarm fanout or scaling IAM evaluation.
Startup succeeds after a configured delay unless resource health is explicitly failed.
Warmup blocks dynamic scale-in; simple policies wait for cooldown, while step policies account
for pending capacity when calculating additional launches. Target tracking is deliberately approximate.

Live UI no longer fabricates EC2 scaling from Multi-AZ, replica count or a stray ASG node.
The old multiplier remains only in low-level compatibility scenarios.

## Sources and verification

Official sources verified 2026-09-24:
- https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-simple-step.html
- https://docs.aws.amazon.com/autoscaling/ec2/userguide/ec2-auto-scaling-default-instance-warmup.html
- https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-target-tracking.html

Tests: `test/asg-scaling.test.ts` and `test/ui/ui-integration.test.ts` cover ownership,
capacity bounds, cooldown, startup/warmup, target eligibility, missing samples, atomic errors,
draft resume/reset, canvas-driven ALB observations, disconnected monitoring, target policy,
and scaling with the inspector closed. No browser screenshot QA performed.

Validation 2026-09-24: 463 tests pass (438 engine/conformance + 25 UI); production build passes
with the existing bundle-size warning.

## Canvas reference update (2026-09-28)

The reference has a separate control column (CloudWatch and ASG), ALB above the EC2 row,
and space for generated instances. Its service nodes opt out of the More information overlay;
policy controls remain in the inspector and effects are real canvas nodes.

AWS sources: [step scaling](https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-simple-step.html),
[scheduled scaling](https://docs.aws.amazon.com/autoscaling/ec2/userguide/ec2-auto-scaling-scheduled-scaling.html),
[target tracking](https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-target-tracking.html).

Verified: 479 tests (447 engine/conformance +32 UI), production build passes with existing
bundle-size warning. UI coverage selects scheduled policy and checks actual node creation/removal;
engine coverage checks step boundaries, warmup, scheduled action timing and target scale-in.
No browser screenshot review was available.

Generated instances are numbered after initial members (EC2 3, EC2 4) and occupy the next available row slots. Existing node positions are unchanged. Regression coverage verifies labels, placement, and editing an active policy without a manual reset.

## ASG membership frames

Canvas renders a dashed orange membership frame around each ASG’s explicit and generated
EC2 members, separately per subnet. Bounds follow actual node positions and measured sizes,
including parent offsets. Frames resize as members move, launch or terminate. They are
noninteractive display-only nodes, never network boundaries or new EC2 parents. Drafts
reconstruct frames from membership; image exports include the visible frames. Layers can
hide ASG membership frames. Regression: test/asg-membership-frames.test.ts.
