import type { Node } from '@xyflow/react';
import { findContainingSubnetBoundary, findContainingVpc } from '../layout/containment.ts';
import { resolveRoute, type RouteTable } from './routeTable.ts';
import { parseCidr, cidrContains } from './cidr.ts';

export interface LiveRouteDecision {
  outcome: 'legacy' | 'allowed' | 'denied' | 'unsupported' | 'invalid';
  reason: string;
}
/** Explicit IPv4 routing gate. Absence of an association preserves legacy diagrams. */
export function evaluateLiveRoute(source: Node<any>, target: Node<any>, nodes: Node<any>[]): LiveRouteDecision {
  const sourceSubnet = findContainingSubnetBoundary(source, nodes);
  const tableId = source.data.networkIdentity?.routeTableId ?? sourceSubnet?.data.networkIdentity?.routeTableId;
  if (tableId === undefined) return { outcome: 'legacy', reason: 'No explicit route table association.' };
  const tableNode = nodes.find(n => n.id === tableId && n.data.serviceId === 'route_tables');
  const table = tableNode?.data.customConfig?.routeTable as RouteTable | undefined;
  if (!table || !Array.isArray(table.routes) || table.routes.some(route =>
    !route || typeof route.destinationCidr !== 'string' || !parseCidr(route.destinationCidr) ||
    !route.target || !['local', 'igw', 'nat', 'vpce', 'peering', 'tgw'].includes(route.target.type))) {
    return { outcome: 'invalid', reason: 'Associated route table has missing or invalid routes.' };
  }
  if (new Set(table.routes.map(route => route.destinationCidr)).size !== table.routes.length) {
    return { outcome: 'invalid', reason: 'Duplicate route destinations require unsupported route-priority semantics.' };
  }
  const destination = target.data.networkIdentity?.privateIp;
  if (typeof destination !== 'string' || destination.includes('/') || !parseCidr(`${destination}/32`)) {
    return { outcome: 'unsupported', reason: 'Explicit routing requires a destination private IPv4 address; DNS and address allocation are not yet modeled.' };
  }
  const resolution = resolveRoute({ ...table, id: tableId }, destination);
  if (!resolution.selectedRoute) return { outcome: 'denied', reason: resolution.reason };
  const route = resolution.selectedRoute;
  if (route.target.type !== 'local') return { outcome: 'unsupported', reason: `${resolution.reason} Live ${route.target.type} transit is not yet modeled.` };
  const targetSubnet = findContainingSubnetBoundary(target, nodes);
  const sourceVpc = sourceSubnet && findContainingVpc(sourceSubnet, nodes);
  const targetVpc = targetSubnet && findContainingVpc(targetSubnet, nodes);
  if (!sourceVpc || !targetVpc) return { outcome: 'unsupported', reason: 'Local routing requires resolved source and destination VPC membership.' };
  if (sourceVpc.id !== targetVpc.id) return { outcome: 'denied', reason: 'A local VPC route cannot reach a resource in another VPC.' };
  if (!targetSubnet?.data.cidr || !cidrContains(targetSubnet.data.cidr, destination)) {
    return { outcome: 'invalid', reason: 'Destination private IPv4 address is outside its subnet CIDR or the CIDR is missing.' };
  }
  return { outcome: 'allowed', reason: `${resolution.reason} Both resources belong to VPC ${sourceVpc.id}; no NAT is required for this local route.` };
}
