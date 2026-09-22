import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowDown, Shield, Package } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import type { ServiceNodeData } from '../../types/index.ts';
import { AwsServiceIcon } from '../icons/AwsServiceIcons.tsx';
import { ServiceLearningPanel } from './ServiceLearningPanel.tsx';
import { LoadBalancerLesson } from './LoadBalancerLesson.tsx';
import { ScalingPolicyLesson } from './ScalingPolicyLesson.tsx';
import { EventBridgeLesson } from './EventBridgeLesson.tsx';

export const BEHAVIOR_EXPLORER_SERVICES = ['alb', 'nlb', 'cloudwatch', 'sqs', 'ec2_auto_scaling', 'auto_scaling_mgmt', 'eventbridge', 'eventbridge_scheduler', 'iam', 'ec2', 'ecr_registry'];
export function ServiceBehaviorExplorer({ node, nodes, edges, onUpdate, onClose }: {
  node: Node<ServiceNodeData>; nodes: Node<ServiceNodeData>[]; edges: Edge[];
  onUpdate: (id: string, patch: Partial<ServiceNodeData>) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const service = node.data.serviceId;
  const isBalancer = service === 'alb' || service === 'nlb';
  const isScaling = ['cloudwatch', 'sqs', 'ec2_auto_scaling', 'auto_scaling_mgmt'].includes(service);
  const isEvent = service === 'eventbridge' || service === 'eventbridge_scheduler';
  const connections = edges.filter(e => e.source === node.id || e.target === node.id);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; ref.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return createPortal(<div className="fixed inset-0 z-[11000] bg-slate-900/60 p-2 sm:p-6 flex items-center justify-center" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="service-behavior-title" tabIndex={-1} className="w-full max-w-6xl h-[92dvh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-900" onKeyDown={e => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab') {
        const items = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { e.preventDefault(); first.focus(); }
      }
    }}>
      <header className="p-4 border-b flex gap-3 items-center"><AwsServiceIcon serviceId={service} size={36} /><div className="flex-1"><p className="text-xs text-slate-500">Service behavior & learning</p><h2 id="service-behavior-title" className="text-lg font-semibold">{node.data.label}</h2></div><button className="p-3 border rounded" onClick={onClose} aria-label="Close service behavior"><X size={20} /></button></header>
      <p className="px-4 py-3 text-xs bg-slate-50 border-b">Service-specific teaching examples. Diagram arrows explain relationships, not containment or verified connectivity. Demo controls do not change your architecture.</p>
      <div className="flex-1 min-h-0 grid lg:grid-cols-[minmax(0,1fr)_340px] overflow-y-auto lg:overflow-hidden">
        <main className="min-w-0 p-5 bg-slate-50 lg:overflow-y-auto">
          {isBalancer && <LoadBalancerLesson kind={service as 'alb' | 'nlb'} />}
          {isScaling && <ScalingPolicyLesson source={service as 'cloudwatch' | 'sqs' | 'ec2_auto_scaling' | 'auto_scaling_mgmt'} />}
          {isEvent && <EventBridgeLesson scheduler={service === 'eventbridge_scheduler'} />}
          {!isBalancer && !isScaling && !isEvent && <div className="space-y-4 text-sm">
            <h3 className="font-semibold text-lg">{service === 'ecr_registry' ? 'Image delivery across services' : 'Permission boundaries across services'}</h3>
            {(service === 'ecr_registry' ? ['Build and push container image', 'ECR repository: image tag or digest', 'ECS agent pulls image using appropriate role', 'Container starts from task definition'] : service === 'ec2' ? ['IAM role inside an instance profile', 'Profile attached to EC2 host', 'ECS agent uses container instance role', 'Application uses its separate task role'] : ['IAM role + trust policy + permissions', 'Task role → application AWS API calls', 'Execution role → supported ECS agent operations', 'Instance profile → role for EC2 host']).map((text, i) => <React.Fragment key={text}>{i > 0 && <ArrowDown className="mx-auto text-circuit-700" aria-hidden="true" />}<div className="border rounded p-4 bg-white flex gap-3 items-center">{service === 'ecr_registry' ? <Package size={22} /> : <Shield size={22} />}{text}</div></React.Fragment>)}
            <p className="text-xs text-slate-600">Each box represents a separate role or service relationship; IAM and ECR are not resources contained inside an ECS cluster. Role trust and authorization still require actual policy evaluation.</p>
          </div>}
        </main>
        <aside aria-label="Service behavior details" className="p-5 border-t lg:border-l lg:border-t-0 lg:overflow-y-auto space-y-4">
          {isEvent ? <><h3 className="font-semibold">Invocation is not service scaling</h3><p className="text-sm">EventBridge rules and Scheduler can invoke ECS RunTask. Application Auto Scaling scheduled actions instead change the bounds of an ECS service’s scalable target.</p><a className="text-sm underline text-circuit-700" target="_blank" rel="noreferrer" href="https://docs.aws.amazon.com/autoscaling/application/userguide/scheduled-scaling-policy-overview.html">AWS: scheduled scaling</a></> : <ServiceLearningPanel ec2Scaling={service === 'ec2_auto_scaling'} topic={isBalancer ? 'balancing' : isScaling ? 'scaling' : service === 'ecr_registry' ? 'registry' : 'roles'} fargate={false} workspace={node.data.customConfig?.serviceLearning ?? {}} onChange={patch => onUpdate(node.id, { customConfig: { ...node.data.customConfig, serviceLearning: { ...node.data.customConfig?.serviceLearning, ...patch } } })} />}
          {service === 'sqs' && <section className="border-t pt-4 text-sm space-y-2"><h4 className="font-semibold">Queue metric requirements</h4><p>Backlog per task = ApproximateNumberOfMessagesVisible / RunningTaskCount. The running-task metric requires ECS Container Insights in this example. Missing data prevents a metric-based decision.</p><p>Choose a backlog target from acceptable queue latency divided by average processing time. SQS does not own the scaling policy. Target tracking is distinct from the three step-adjustment expressions.</p><a className="underline text-circuit-700" target="_blank" rel="noreferrer" href="https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-autoscaling-queue.html">AWS: SQS backlog-based ECS scaling</a></section>}
          <section className="border-t pt-4 space-y-2"><h3 className="font-semibold text-sm">Actual canvas connections</h3><p className="text-xs text-slate-500">These links are shown for context; the teaching example does not infer registrations or permissions from them.</p>{!connections.length && <p className="text-sm">No connected resources.</p>}{connections.map(e => <p key={e.id} className="border rounded p-2 text-sm">{e.source === node.id ? 'To: ' : 'From: '}{nodes.find(n => n.id === (e.source === node.id ? e.target : e.source))?.data.label || 'Missing resource'}</p>)}</section>
        </aside>
      </div>
    </div>
  </div>, document.body);
}
