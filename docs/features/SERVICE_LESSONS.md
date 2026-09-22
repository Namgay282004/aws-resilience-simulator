# Service-specific behavior lessons

Select a resource icon, then **More information**. Each view is scoped to that service. ECS no longer embeds the cross-service playground. Actual canvas connections are listed separately from clearly labeled example resources. Load balancer targets are drawn outside the load balancer boundary.

| Icon | Lesson | Responsibility |
| --- | --- | --- |
| ALB | HTTP path rules, independent per-group round robin | Layer 7 request routing; does not scale application capacity |
| NLB | TCP connection affinity and new connections | Layer 4 transport routing; ignores HTTP path; illustrative hash assignment |
| CloudWatch | Metric/alarms → scaling policy → capacity | Metric source and alarms, not policy owner |
| SQS | Visible messages / running workers → backlog per task | Queue metric source; Application Auto Scaling owns the worker policy |
| EC2 Auto Scaling | Metric-driven or scheduled fleet sizing | Policy changes instance capacity in an ASG |
| AWS Auto Scaling | Example Application Auto Scaling task policies and scheduled bounds | Explicit ECS example, not universal resource behavior |
| EventBridge | Event pattern match → ECS RunTask | Standalone tasks, not service desired-count scaling |
| EventBridge Scheduler | Schedule → ECS RunTask | Scheduled task invocation, distinct from scheduled scaling |
| IAM / EC2 | Role trust, task/execution/host roles, instance profiles | IAM permission relationships and EC2 profile attachment |
| ECR | Build/push → repository → authenticated pull → container | Image distribution, not workload execution |

## AWS rules and sources

- ALB evaluates listener rules and routes each request within the selected target group. Example uses round robin with independent counters per group: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html
- NLB TCP traffic uses flow hashing; a connection remains on one target for its lifetime. New connections may select other targets: https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html
- SQS backlog per task divides `ApproximateNumberOfMessagesVisible` by `RunningTaskCount`. The ECS Container Insights running-count metric must exist; absent metrics do not produce a scaling decision: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-autoscaling-queue.html
- `ChangeInCapacity`, `PercentChangeInCapacity`, and `ExactCapacity` are **step adjustment expressions**, not policies assigned to separate source services. Signed percentage adjustments round magnitude down except that nonzero magnitudes below one become one: https://docs.aws.amazon.com/autoscaling/application/userguide/step-scaling-policy-overview.html
- Target tracking and step scaling use CloudWatch metrics/alarms. Scheduled scaling changes bounds based on time, independently of metric demand: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-auto-scaling.html and https://docs.aws.amazon.com/autoscaling/application/userguide/scheduled-scaling-policy-overview.html
- EC2 Auto Scaling changes EC2 group capacity: https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scale-based-on-demand.html
- EventBridge's configured ECS target invokes RunTask. Scheduler likewise can invoke RunTask, requiring appropriate execution and pass-role permissions. Neither example mutates an ECS service's desired count: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-targets.html and https://docs.aws.amazon.com/AmazonECS/latest/developerguide/tasks-scheduled-eventbridge-scheduler.html
- ECS roles: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security-ecs-iam-role-overview.html
- Instance profiles: https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-ec2_instance-profiles.html
- ECR: https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html

## Implementation and limits

`ServiceBehaviorExplorer` routes by actual service ID, so an NLB never switches into an ALB. Components live in `src/components/learning`. Documented step arithmetic and metric examples live outside React in `src/engine/education/serviceScalingExample.ts`.

Examples do not configure actual policies or run the request engine. Target-tracking counts are proportional teaching estimates, not AWS's complete adjustment algorithm. Stages are compressed and assume available capacity/startup. Real cooldowns, alarms, deployment safeguards, cross-zone routing, unhealthy-target/fail-open behavior, policy combinations, quotas, and zero-worker bootstrapping are outside coverage. A metric snapshot must be reevaluated explicitly; the demo is not a live controller.

The SQS example uses a 50-message-per-task target; the correct production value depends on acceptable latency and processing time. Task count is bounded to 1–8 in the UI. The example scheduled action raises the minimum to six while retaining a maximum of eight; it never implies that EventBridge is the scheduled-scaling engine. Step UI controls show positive adjustments, while arithmetic supports and tests signed adjustments.

IAM/ECR design annotations on their own nodes use `customConfig.serviceLearning`. Existing ECS annotations remain intact. An ARN annotation never grants permissions. No example writes resource counts, changes architecture links, provisions resources, or overwrites existing custom settings.

## Verification

UI integration checks cover icon ownership, ECS exclusion, independent ALB groups, NLB connection affinity, missing SQS metrics, animated count changes, all three expressions at CloudWatch, EC2 scheduled controls, EventBridge matching/nonmatching events, Scheduler/ECR entry points, and architecture preservation. Arithmetic tests cover signed percentage rounding, exact capacity, normalized backlog, missing data, and scheduled load independence. Existing engine and AWS conformance tests remain in the regression run.
