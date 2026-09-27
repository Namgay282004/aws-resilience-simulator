# ECS compute layout

The ECS explorer presents logical service/task groups and cluster compute as separate
sections. Services manage tasks, EC2 instances host tasks, and tasks contain containers.
Fargate is explicitly shown without customer-managed EC2 hosts.

Existing `ecsWorkspace.instanceCount` and `instanceType` remain per-service design metadata.
The UI preserves edit access and never sums those values or infers shared host identities,
capacity-provider membership, ASG membership, or actual task placements.

## Scope

The scale-out and scale-in walkthroughs were removed at the user's request.
The corrected compute layout remains. Host identities, actual placement, capacity-provider
membership, and lifecycle scheduling are not simulated by this overlay.

Sources verified 2026-09-23:
- https://docs.aws.amazon.com/AmazonECS/latest/developerguide/managed-scaling-behavior.html
- https://docs.aws.amazon.com/AmazonECS/latest/developerguide/managed-instance-draining.html
- https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-auto-scaling.html

## Verification

`test/ui/ui-integration.test.ts` exercises compute/service separation, container editing,
and Fargate switching. No browser screenshot review performed.
