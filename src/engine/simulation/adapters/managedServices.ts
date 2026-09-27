import { operate, OPERATION_SERVICES, type Operation } from '../../services/operations.ts';
import { CONTINUE, TERMINATE, type Adapter } from './types.ts';
export const managedServicesAdapter: Adapter = ctx => {
  const self = OPERATION_SERVICES.includes(ctx.node.data.serviceId);
  const target = self ? ctx.node : ctx.downstreamNodes.find(n => OPERATION_SERVICES.includes(n.data.serviceId));
  if (!target || (!self && ctx.orderedConnections && target.id !== ctx.downstreamNodes[0]?.id)) return CONTINUE;
  if (!self && ctx.pushFirewallBlockIfAny(ctx.node, target, 'HTTPS')) return TERMINATE;
  const operations: Record<string, Operation> = { sqs: 'send', sns: 'publish', cloudwatch: 'metric', cloudtrail: 'audit' };
  try {
    const result = operate(ctx.nodes, ctx.allEdges, target.id, operations[target.data.serviceId], {
      body: ctx.scenario.path, value: target.data.customConfig?.metricValue === '' ? undefined : target.data.customConfig?.metricValue,
      action: target.data.customConfig?.eventName, category: target.data.customConfig?.eventCategory
    });
    for (const text of result.trace) ctx.trace.pushStep({ sourceNodeId: ctx.node.id, targetNodeId: target.id,
      sourceNodeName: ctx.node.data.label, targetNodeName: target.data.label, protocol: 'Message',
      action: `${target.data.serviceId}: ${operations[target.data.serviceId]}`, status: 'success', explanation: text,
      targetHealth: target.data.health, latencyMs: 0 });
    for (const n of result.nodes) if (n.data.customConfig?.serviceRuntime) ctx.trace.serviceStates[n.id] = n.data.customConfig.serviceRuntime;
    ctx.trace.succeed(target.data.serviceId === 'sqs' ? 202 : 200, `${target.data.label}: operation accepted. See trace for delivery, alarm or audit outcomes.`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Operation failed.';
    ctx.trace.pushStep({ sourceNodeId: ctx.node.id, targetNodeId: target.id, sourceNodeName: ctx.node.data.label,
      targetNodeName: target.data.label, protocol: 'Message', action: 'Managed service operation', status: 'failed',
      explanation: reason, targetHealth: target.data.health, latencyMs: 0 });
    ctx.trace.fail(400, reason);
  }
  return TERMINATE;
};
