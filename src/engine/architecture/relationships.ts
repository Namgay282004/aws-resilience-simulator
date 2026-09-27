/** Relationship meaning is independent of line geometry and request protocol. */
export type RelationshipKind = 'authorization' | 'request' | 'dependency' | 'manages' | 'route-association' | 'target-registration';
interface RelationshipData {
  relationship?: RelationshipKind;
  traversal?: 'forward' | 'dependency';
  signalType?: unknown;
}
export function relationshipKind(data?: RelationshipData): RelationshipKind {
  return data?.relationship ?? (data?.traversal === 'dependency' ? 'dependency' : 'request');
}
export function carriesRequest(data?: RelationshipData): boolean {
  return data?.signalType !== 'outbound_response' && relationshipKind(data) === 'request';
}
export function isDependencyCall(data?: RelationshipData): boolean {
  return data?.signalType !== 'outbound_response' && relationshipKind(data) === 'dependency';
}
