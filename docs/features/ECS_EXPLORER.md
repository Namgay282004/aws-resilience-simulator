# ECS component explorer

Select an ECS canvas node and click **More information** in its inspector. The overlay is opt-in and closes with Escape, its close button, or the backdrop. The diagram nests service boundaries inside the cluster, task snapshot boxes inside each service, and container boxes inside each task. Component selection opens a right-hand editor (stacked below the diagram on narrow screens). Container selection opens that specific shared container definition; edits appear across the service’s task illustrations. All services in the cluster remain visible while switching selection. Keyboard focus stays inside the overlay and returns on close.

The existing contract is preserved: one ECS canvas node represents one simulated service. Set a cluster name in the explorer to group ECS nodes with exactly the same name. Services retain their own task definition, launch type, counts, connections, and health. Naming a cluster does not change network reachability. Blank cluster names remain isolated.

## Storage and coverage

- Existing `customConfig.ecs` retains launch type, network mode, desired count and observed running count; these continue to drive the existing ECS behavior engine.
- `customConfig.ecsWorkspace` stores cluster/service names, task definition family, CPU/memory, task and execution role ARN annotations, log group, container definitions, and EC2 host annotations. Normal architecture save/export includes these fields. Existing custom configuration is preserved on edits.
- Workspace fields are **design configuration only**. They do not provision resources, validate a complete AWS task definition, register revisions, bind IAM roles, simulate container startup, place tasks, or affect cost. Existing IAM configuration and networking remain authoritative.
- Tasks are drawn from the aggregate observed count, capped at six boxes per service with an explicit remainder count. Zero running tasks shows an empty state. Numbered boxes are schematic positions, not task IDs or placements. Containers show the saved blueprint, not verified live container state. Desired count does not imply observed running count.
- EC2 displays customer host annotations. Fargate displays managed compute and retains any EC2 annotations when switching back.
- Associated resources are derived from actual canvas edges and attached security group IDs. They are not inferred to be reachable. Placement and security groups remain editable in the existing inspector.

## AWS source rules

- A cluster logically groups services and tasks and can contain different compute types: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/clusters.html
- Services maintain tasks based on task definitions; EC2 and Fargate represent distinct compute choices: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-configuration.html
- A task definition describes containers, task size, networking and roles. Fargate requires awsvpc; supported CPU/memory combinations must be checked against AWS documentation: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html

The existing engine supports only awsvpc ECS networking. This UI adds no new AWS behavioral claims and does not imply full ECS coverage.

## Verification

The ECS explorer UI integration regression verifies opt-in visibility, persisted container edits, unrelated configuration preservation, launch type switching, cluster service grouping, closing with Escape, reopening with saved state, nested cluster/service/task/container boundaries, container selection and live name edits, zero-task empty states, and capped rendering for large task counts. Existing ECS and AWS conformance tests remain unchanged.

## Service ownership

External-service teaching content has moved out of the ECS explorer. ALB, NLB, SQS, CloudWatch, EventBridge, EventBridge Scheduler, EC2 Auto Scaling, AWS Auto Scaling, IAM, EC2, and ECR now expose their respective lessons from their own inspector's **More information** button. See [Service lessons](SERVICE_LESSONS.md).

ECS retains only its cluster/service/task/container diagram, task definition fields (including role ARN references), compute annotations, and actual networking references. Role references in a task definition do not mean IAM is contained in the cluster.
