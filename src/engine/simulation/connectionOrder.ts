import type { Edge, Node } from '@xyflow/react';
import type { ConnectionData, ServiceNodeData } from '../../types/index.ts';
export function hasStepNumber(edge: Edge<ConnectionData>): boolean {
  const value = edge.data?.stepNumber;
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
/** Stable priority: numbered connections first; absent/invalid numbers retain legacy order. */
export function orderConnections<T extends Edge<ConnectionData>>(edges: T[]): T[] {
  if (!edges.some(hasStepNumber)) return edges;
  return [...edges].sort((a, b) => (hasStepNumber(a) ? a.data!.stepNumber! : Infinity) - (hasStepNumber(b) ? b.data!.stepNumber! : Infinity));
}
export function orderTargets(nodes: Node<ServiceNodeData>[], edges: Edge<ConnectionData>[]): Node<ServiceNodeData>[] {
  if (!edges.some(hasStepNumber)) return nodes;
  const priority = (id: string) => Math.min(...edges.filter(e => e.target === id && hasStepNumber(e)).map(e => e.data!.stepNumber!), Infinity);
  return [...nodes].sort((a, b) => priority(a.id) - priority(b.id));
}
