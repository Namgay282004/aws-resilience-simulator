import React from 'react';
import type { EcsWorkspace } from '../ecs/EcsExplorer.tsx';
export type LearningTopic = 'roles' | 'registry' | 'balancing' | 'scaling';
export const isLearningTopic = (value: string | null): value is LearningTopic => ['roles', 'registry', 'balancing', 'scaling'].includes(value || '');
const source = (url: string, label: string) => <a className="block text-circuit-700 underline text-sm" href={url} target="_blank" rel="noreferrer">{label}</a>;
export function ServiceLearningPanel({ topic, fargate, workspace, onChange, ec2Scaling = false }: { ec2Scaling?: boolean; topic: LearningTopic; fargate: boolean; workspace: EcsWorkspace; onChange: (patch: Partial<EcsWorkspace>) => void }) {
  const field = (label: string, key: 'instanceProfile' | 'taskRole' | 'executionRole' | 'repository') => <label className="block text-sm font-medium">{label}<input className="w-full mt-1 border border-slate-300 rounded p-2 text-sm" value={workspace[key] || ''} onChange={e => onChange({ [key]: e.target.value })} /><span className="block text-xs text-slate-500 mt-1">Saved design annotation; does not grant permissions or create a resource.</span></label>;
  return <div className="space-y-4 text-sm text-slate-700">
    {topic === 'roles' && <>
      <section className="border-l-4 border-orange-300 pl-3"><h4 className="font-semibold text-slate-900">EC2 instance profile → container instance role</h4><p className="mt-1">An instance profile carries an IAM role to an EC2 host. The ECS agent uses the container instance role to register the host and communicate with ECS; it can also pull ECR images.</p><p className="mt-2">{fargate ? 'Fargate: you do not configure a customer EC2 instance profile.' : 'EC2 launch type: attach the profile to the host, not to each task.'}</p></section>
      {!fargate && field('Instance profile ARN', 'instanceProfile')}
      <section className="border-l-4 border-circuit-400 pl-3"><h4 className="font-semibold text-slate-900">Task role → application permissions</h4><p className="mt-1">Your containerized application receives credentials for this role to call AWS APIs, such as reading an S3 object. Scope policies to the actions and resources the application needs.</p></section>
      {field('Task role ARN', 'taskRole')}
      <section className="border-l-4 border-sky-300 pl-3"><h4 className="font-semibold text-slate-900">Task execution role → agent startup work</h4><p className="mt-1">Used by the ECS/Fargate agent for supported startup operations: private ECR image pulls, CloudWatch logs, and referenced secrets. These credentials are not directly exposed to application containers. On EC2, image pull permissions can come from the instance role; requirements depend on the feature.</p></section>
      {field('Task execution role ARN', 'executionRole')}
      <p className="text-xs">Roles also require appropriate trust policies. Task and execution roles trust ecs-tasks.amazonaws.com; the EC2 host role trusts ec2.amazonaws.com. ARN annotations here do not replace the simulator’s policy-based IAM configuration.</p>
      {source('https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security-ecs-iam-role-overview.html', 'AWS: ECS IAM roles')}
      {source('https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-ec2_instance-profiles.html', 'AWS: instance profiles')}
    </>}
    {topic === 'registry' && <>
      <h4 className="font-semibold text-slate-900">ECR stores images; ECS runs them</h4><p>Build a container image, push it to an ECR repository, and reference its image URI in the task definition. A starting task pulls that image before launching the container.</p>
      {field('ECR repository URI', 'repository')}
      <ol className="list-decimal pl-5 space-y-2"><li>Build and push an image tagged with a version.</li><li>Set the container image URI or immutable digest in the task definition.</li><li>The agent authenticates and pulls the image over a working network path.</li><li>ECS starts the task; application traffic goes to the container, not ECR.</li></ol>
      <p>Image availability, IAM permissions, and network access are separate requirements. A private subnet needs the relevant outbound path or VPC endpoints. Updating a tag does not update already-running containers automatically.</p>
      <p className="text-xs">The demo assumes pull success. It does not build, push, authenticate, or download an image.</p>
      {source('https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html', 'AWS: Amazon ECR')}
      {source('https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html', 'AWS: execution role permissions')}
    </>}
    {topic === 'balancing' && <>
      <h4 className="font-semibold text-slate-900">Client → listener → target group → task</h4><p>The listener accepts traffic on a configured protocol and port. A target group identifies registered destinations and health checks. With awsvpc tasks, use IP targets for task ENIs.</p>
      <section className="border rounded p-3"><h4 className="font-semibold">L7 · Application Load Balancer</h4><p>Understands HTTP requests. Listener rules can route /api/* to an API target group and other paths to a web target group, or match hostnames. Target selection occurs per request.</p></section>
      <section className="border rounded p-3"><h4 className="font-semibold">L4 · Network Load Balancer</h4><p>Routes transport flows such as TCP/UDP. For TCP, flow hashing chooses a target and keeps that connection on the target. It does not route by HTTP URL or hostname. TLS listeners can terminate TLS, but that does not add HTTP path routing.</p></section>
      <p>New tasks must start and become eligible targets before receiving traffic. Removing targets involves deregistration and draining. A load balancer distributes work; ECS Service Auto Scaling adjusts task count separately.</p>
      <p className="text-xs">The animation assumes healthy targets. Fail-open behavior when all targets are unhealthy, cross-zone settings, stickiness, and draining timing are not modeled.</p>
      {source('https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html', 'AWS: Application Load Balancer')}
      {source('https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html', 'AWS: Network Load Balancer')}
      {source('https://docs.aws.amazon.com/AmazonECS/latest/developerguide/alb.html', 'AWS: ECS target registration')}
    </>}
    {topic === 'scaling' && <>
      <h4 className="font-semibold text-slate-900">{ec2Scaling ? 'EC2 fleet capacity' : 'Two independent capacity decisions'}</h4><p>{ec2Scaling ? 'EC2 Auto Scaling adjusts the instance count in an Auto Scaling group. CloudWatch supplies metrics and alarms. A fleet can host ECS tasks, but EC2 instance scaling and ECS service task scaling are different decisions.' : 'Application Auto Scaling adjusts an ECS service’s desired task count. An EC2 Auto Scaling group capacity provider with managed scaling can separately add hosts. Fargate removes the customer host-scaling step.'}</p>
      <dl className="space-y-3"><div><dt className="font-semibold">Target tracking</dt><dd>Maintain a metric target, such as average CPU utilization. {ec2Scaling ? 'EC2 Auto Scaling' : 'Application Auto Scaling'} manages the alarms and adjustments.</dd></div><div><dt className="font-semibold">Step scaling</dt><dd>CloudWatch alarm breaches trigger adjustments based on breach size. The demo uses one threshold and one adjustment.</dd></div><div><dt className="font-semibold">Scheduled scaling</dt><dd>Change minimum/maximum capacity at known times. The demo manually triggers a scheduled minimum increase; load does not trigger it.</dd></div></dl>
      <h4 className="font-semibold text-slate-900">Three ways to express a step adjustment</h4><p className="text-xs">These expressions belong to the scaling policy, not to the metric source. Examples below use task counts; for EC2 Auto Scaling the units are instances.</p>
      <ul className="list-disc pl-5 space-y-2"><li><strong>ChangeInCapacity:</strong> add 2 tasks; 4 → 6.</li><li><strong>PercentChangeInCapacity:</strong> add 50%; 4 → 6.</li><li><strong>ExactCapacity:</strong> set capacity to 6; 4 → 6.</li></ul>
      <p>Fixed and percentage adjustments can also be negative for scale-in. Exact capacity is an absolute count. Bounds, alarm evaluation, cooldowns, task startup, and health checks affect real scaling.</p>
      <p className="text-xs">AWS also supports predictive scaling. This demonstration covers the three mechanisms above, uses positive step adjustments, and omits predictive scaling, real timings, quotas, costs, and failure cases.</p>
      {source(ec2Scaling ? 'https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scale-based-on-demand.html' : 'https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-auto-scaling.html', 'AWS: scaling policies')}
      {source('https://docs.aws.amazon.com/autoscaling/application/userguide/step-scaling-policy-overview.html', 'AWS: adjustment types and rounding')}
      {source('https://docs.aws.amazon.com/AmazonECS/latest/developerguide/cluster-auto-scaling.html', 'AWS: EC2 cluster auto scaling')}
    </>}
  </div>;
}
