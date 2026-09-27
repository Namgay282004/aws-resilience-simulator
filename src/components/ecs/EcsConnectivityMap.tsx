import React from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { ServiceNodeData, NodeHealth } from '../../types/index.ts';
import { AwsServiceIcon } from '../icons/AwsServiceIcons.tsx';
import { ecsConfiguration } from '../../engine/service/models/ecs.ts';
import { Layers, ArrowDown } from 'lucide-react';

const safeCount = (value: number) => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
const MAX_SQUARES = 24;

const HEALTH_COLOR: Record<NodeHealth, string> = {
  healthy: 'bg-emerald-600',
  degraded: 'bg-amber-500',
  failed: 'bg-rose-600'
};

interface ExternalLink { node: Node<ServiceNodeData>; protocol?: string; relatedServiceLabels: string[] }

/** ECS nodes are usually labeled generically on canvas ("Amazon ECS"); the name a student actually
 *  gave the service lives in its saved workspace instead - fall back to that the same way
 *  EcsTopology does, so a service shows the same name here as it does there. */
function displayLabel(node: Node<ServiceNodeData>): string {
  return node.data.customConfig?.ecsWorkspace?.serviceName || node.data.label;
}

/** A boxed icon+label, the same visual language the original wide connectivity diagram used for
 *  an external component (e.g. an ALB) - just laid out in normal document flow instead of
 *  absolutely-positioned lanes, so it fits the sidebar's width. */
function ExternalBox({ node }: { node: Node<ServiceNodeData> }) {
  return <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5" title={node.data.label}>
    <AwsServiceIcon serviceId={node.data.serviceId} size={18} className="shrink-0" />
    <span className="min-w-0 text-xs font-semibold truncate">{node.data.label}</span>
  </div>;
}

/** The arrow between two boxes, labeled with the connection's protocol when known - "ALB with an
 *  arrow pointing at ECS," restored from the original diagram, just drawn vertically. */
function ConnectorArrow({ protocol }: { protocol?: string }) {
  return <div className="flex flex-col items-center py-0.5" aria-hidden="true">
    <ArrowDown size={14} className="text-slate-400" />
    {protocol && <span className="text-[9px] font-mono text-slate-400">{protocol}</span>}
  </div>;
}

/**
 * A live connectivity + status widget for the detail sidebar. An ECS cluster is a logical grouping
 * of services/tasks - a load balancer, database, or anything else it talks to is a separate AWS
 * resource, not part of the cluster - so external components render as their own boxes OUTSIDE a
 * dedicated cluster boundary box, never nested inside it, matching how these are genuinely
 * distinct resources in AWS. An external node connected to several services in the cluster (e.g.
 * one ALB fanning out) is drawn once, with a caption naming every service it reaches, rather than
 * being duplicated per service.
 *
 * Inside the boundary, each service's own box shows its current state - one small square per
 * running task, colored by that service's health (the model tracks health per service/node, not
 * per individual task, so every square for a service shares its color - this doesn't invent
 * per-task health data that doesn't exist). A dashed outline square marks a task that's desired
 * but not yet running. A service that's actually the target of an inbound connection gets a small
 * "routed to these tasks" marker right above its square row (and "these tasks call out" below it
 * for outbound) - pointing at the task pool as a whole, since the model has no notion of which
 * individual task an ALB happened to route to; fabricating a line to one specific square would be
 * inventing data the simulator doesn't have. Everything here updates immediately as task counts,
 * health, or canvas connections change.
 *
 * An edge between two services *inside* the same cluster is neither inbound nor outbound for the
 * cluster as a whole, so it's excluded from the external boxes and reported as a count instead of
 * being silently dropped. This is a connectivity/status overview, not a request-simulation result -
 * boxes and arrows show a configured link exists, not that a request would succeed across it.
 */
export function EcsConnectivityMap({ services, nodes, edges, clusterName, onSelectService }: {
  services: Node<ServiceNodeData>[];
  nodes: Node<ServiceNodeData>[];
  edges: Edge[];
  clusterName: string;
  onSelectService: (serviceId: string) => void;
}) {
  const serviceIds = new Set(services.map(s => s.id));
  const serviceById = new Map(services.map(s => [s.id, s]));
  let internalCount = 0;
  const inboundByExternalId = new Map<string, { node: Node<ServiceNodeData>; protocol?: string; targetIds: string[] }>();
  const outboundByExternalId = new Map<string, { node: Node<ServiceNodeData>; protocol?: string; sourceIds: string[] }>();
  // Which services are actually a target/source of a real edge - used to point the "routed here" /
  // "calls out from here" markers at a specific service's task pool, not the whole cluster.
  const servicesWithInbound = new Set<string>();
  const servicesWithOutbound = new Set<string>();

  for (const edge of edges) {
    const sourceInCluster = serviceIds.has(edge.source);
    const targetInCluster = serviceIds.has(edge.target);
    if (!sourceInCluster && !targetInCluster) continue;
    if (sourceInCluster && targetInCluster) { internalCount += 1; continue; }
    const protocol = (edge.data as { protocol?: string } | undefined)?.protocol;

    if (targetInCluster) {
      const external = nodes.find(n => n.id === edge.source);
      if (!external) continue;
      const entry = inboundByExternalId.get(external.id) ?? { node: external, protocol, targetIds: [] };
      if (!entry.targetIds.includes(edge.target)) entry.targetIds.push(edge.target);
      inboundByExternalId.set(external.id, entry);
      servicesWithInbound.add(edge.target);
    } else {
      const external = nodes.find(n => n.id === edge.target);
      if (!external) continue;
      const entry = outboundByExternalId.get(external.id) ?? { node: external, protocol, sourceIds: [] };
      if (!entry.sourceIds.includes(edge.source)) entry.sourceIds.push(edge.source);
      outboundByExternalId.set(external.id, entry);
      servicesWithOutbound.add(edge.source);
    }
  }

  const inbound: ExternalLink[] = [...inboundByExternalId.values()].map(e => ({
    node: e.node, protocol: e.protocol, relatedServiceLabels: e.targetIds.map(id => displayLabel(serviceById.get(id)!))
  }));
  const outbound: ExternalLink[] = [...outboundByExternalId.values()].map(e => ({
    node: e.node, protocol: e.protocol, relatedServiceLabels: e.sourceIds.map(id => displayLabel(serviceById.get(id)!))
  }));
  const hasAnyConnection = inbound.length > 0 || outbound.length > 0;

  return <div aria-label="ECS cluster connectivity map" className="space-y-1">
    {inbound.map(link => <div key={`in-${link.node.id}`} className="space-y-0.5">
      <ExternalBox node={link.node} />
      <p className="text-[9px] text-slate-500 text-center truncate" title={`Routes to: ${link.relatedServiceLabels.join(', ')}`}>→ {link.relatedServiceLabels.join(', ')}</p>
      <ConnectorArrow protocol={link.protocol} />
    </div>)}

    <div aria-label="Cluster boundary" className="rounded-lg border-2 border-circuit-600 bg-circuit-50/40 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Layers size={16} className="text-circuit-700 shrink-0" aria-hidden="true" />
        <span className="truncate">Cluster: {clusterName}</span>
      </div>

      {services.map(service => {
        const config = ecsConfiguration(service.data);
        const running = safeCount(config.runningCount ?? service.data.replicas ?? 1);
        const desired = safeCount(config.desiredCount ?? service.data.replicas ?? 1);
        const gap = Math.max(0, desired - running);
        const containers = service.data.customConfig?.ecsWorkspace?.containers ?? [];
        const health = service.data.health ?? 'healthy';
        const shownRunning = Math.min(running, MAX_SQUARES);
        const shownGap = Math.min(gap, Math.max(0, MAX_SQUARES - shownRunning));
        const hiddenCount = (running - shownRunning) + (gap - shownGap);

        const isTargeted = servicesWithInbound.has(service.id);
        const callsOut = servicesWithOutbound.has(service.id);

        return <div key={service.id} className="rounded-lg border-2 border-circuit-400 bg-white p-2.5 space-y-2">
          <button onClick={() => onSelectService(service.id)} className="w-full flex items-center gap-2 text-left hover:underline">
            <AwsServiceIcon serviceId={service.data.serviceId} size={18} className="shrink-0" />
            <span className="min-w-0 text-xs font-bold text-circuit-700 truncate">{displayLabel(service)}</span>
          </button>

          {/* Points at the task pool specifically, not just the service box - a real ALB target
              group routes to whichever tasks are registered, not one arbitrary square, so this
              marks the whole row as the destination rather than fabricating one specific task. */}
          {isTargeted && <div className="flex items-center gap-1 text-[9px] text-slate-400" aria-hidden="true"><ArrowDown size={10} />routed to these tasks</div>}

          <div className="flex flex-wrap gap-1" role="img" aria-label={`${running} running of ${desired} desired tasks, health: ${health}`}>
            {Array.from({ length: shownRunning }, (_, i) => (
              <span key={`run-${i}`} className={`w-3.5 h-3.5 rounded-sm ${HEALTH_COLOR[health] ?? 'bg-slate-400'}`} title={`Running task ${i + 1} (${health})`} />
            ))}
            {Array.from({ length: shownGap }, (_, i) => (
              <span key={`gap-${i}`} className="w-3.5 h-3.5 rounded-sm border border-dashed border-slate-400" title="Desired but not yet running" />
            ))}
            {hiddenCount > 0 && <span className="text-[10px] text-slate-500 self-center">+{hiddenCount}</span>}
            {running === 0 && desired === 0 && <span className="text-[10px] text-slate-400">No tasks</span>}
          </div>

          {callsOut && <div className="flex items-center gap-1 text-[9px] text-slate-400" aria-hidden="true"><ArrowDown size={10} />these tasks call out</div>}

          <p className="text-[10px] text-slate-500">
            {running}/{desired} tasks running · {containers.length} container{containers.length === 1 ? '' : 's'}{containers.length > 0 ? ` (${containers.map((c: any) => c.name || 'unnamed').join(', ')})` : ''}
          </p>
        </div>;
      })}

      {!hasAnyConnection && <p className="text-[10px] text-slate-500">No connections into or out of this cluster yet. Connect a load balancer or other service to a cluster service on the canvas.</p>}
      {internalCount > 0 && <p className="text-[10px] text-slate-500">{internalCount} connection{internalCount === 1 ? '' : 's'} between services inside this cluster (not shown here).</p>}
    </div>

    {outbound.map(link => <div key={`out-${link.node.id}`} className="space-y-0.5">
      <ConnectorArrow protocol={link.protocol} />
      <p className="text-[9px] text-slate-500 text-center truncate" title={`Called by: ${link.relatedServiceLabels.join(', ')}`}>{link.relatedServiceLabels.join(', ')} →</p>
      <ExternalBox node={link.node} />
    </div>)}
  </div>;
}
