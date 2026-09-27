import type { Node, Edge } from '@xyflow/react';
import type { SimulationResult } from '../../types/index.ts';
import { advanceAsg, asgReady, type AsgConfig } from './asg.ts';

/** One representative traced request stands for a synthetic one-minute load batch.
 * These volumes are teaching inputs, not measured AWS CPU or individual executed requests.
 */
export const REQUEST_BATCH = { low: 30, normal: 120, high: 240, very_high: 600, '10x': 1200, '100x': 12000 };
export function observeAlbRequests(nodes: Node<any>[], edges: Edge<any>[], result: SimulationResult) {
  let graph = { nodes, edges };
  const notes: string[] = [];
  for (const group of nodes.filter(n => n.data.serviceId === 'ec2_auto_scaling' && n.data.customConfig?.asg?.metricSource === 'alb')) {
    const config = group.data.customConfig.asg as AsgConfig;
    const alb = nodes.find(n => n.id === config.loadBalancerId && n.data.serviceId === 'alb');
    if (!alb) continue;
    // A successful ALB target-selection step proves the request reached this ALB and a target.
    // Failures later in the application still represent load on the ALB.
    const routed = result.steps.some(step => step.sourceNodeId === alb.id && step.targetNodeId !== alb.id && step.action.startsWith('Route to ') && step.status === 'success');
    const waitingForTargets = result.steps.some(step => step.sourceNodeId === alb.id && step.action === 'Target Health Check: ALL TARGETS FAILED');
    if (!routed && !waitingForTargets) continue;
    const monitoring = edges.some(e => e.source === alb.id && e.target === config.alarmId && e.data?.relationship === 'manages');
    if (!monitoring) { notes.push(`${group.data.label}: add an ALB → CloudWatch monitoring connection (Management relationship).`); continue; }
    const targets = new Set(edges.filter(e => e.source === alb.id && (!e.data?.relationship || e.data.relationship === 'request')).map(e => e.target));
    const members = nodes.filter(n => targets.has(n.id) && (config.memberIds.includes(n.id) || n.data.customConfig?.asgInstance?.groupId === group.id) && n.data.health === 'healthy' && asgReady(n.data));
    const routedToGroup = result.steps.some(step => step.sourceNodeId === alb.id && step.action.startsWith('Route to ') && step.status === 'success' && members.some(member => member.id === step.targetNodeId));
    const requests = REQUEST_BATCH[result.scenario.trafficLevel] ?? REQUEST_BATCH.normal;
    const metric = routedToGroup && members.length ? requests / members.length : undefined;
    try {
      const scaled = advanceAsg(graph.nodes, graph.edges, group.id, metric, members.length);
      const alarm = scaled.nodes.find(n => n.id === config.alarmId)!;
      alarm.data.customConfig.asgObservation = { requests, targets: members.length, value: metric ?? null, albId: alb.id, periodSeconds: 60 };
      graph = scaled;
      notes.push(metric === undefined ? `${alb.data.label}: no healthy target selection; metric missing, lifecycle clock advanced.` : `${alb.data.label}: synthetic ${requests} requests / ${members.length} healthy ASG targets = ${metric.toFixed(1)} requests/target for 60s.`, ...scaled.trace);
    } catch (error) { notes.push(`${group.data.label}: scaling not applied — ${error instanceof Error ? error.message : String(error)}`); }
  }
  return { ...graph, notes };
}
