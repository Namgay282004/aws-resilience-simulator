import type { Node } from '@xyflow/react';
import type { LabReference } from '../../data/courseLabShared.ts';
import type { ProtocolType } from '../../types/index.ts';
import { checkConnection } from './connectionContracts.ts';

/** Recreate the active lab's supplied topology without claiming unimplemented runtime support.
 * Only pairs already present in that reference qualify; known-invalid requests never do.
 */
export function labAnnotationProtocol(reference: LabReference | null, source: Node<any>, target: Node<any>): ProtocolType | undefined {
  if (!reference) return undefined;
  for (const edge of reference.edges) {
    const from = reference.nodes.find(n => n.id === edge.source);
    const to = reference.nodes.find(n => n.id === edge.target);
    if (from?.data.serviceId !== source.data.serviceId || to?.data.serviceId !== target.data.serviceId) continue;
    if (checkConnection(source, target, edge.data).status === 'unknown') return edge.data?.protocol;
  }
  return undefined;
}
