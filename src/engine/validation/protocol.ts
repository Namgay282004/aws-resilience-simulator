import { checkConnection } from '../architecture/connectionContracts.ts';
import type { Node, Edge } from '@xyflow/react';
import type { ServiceNodeData, ConnectionData } from '../../types/index.ts';
import { makeFinding, type Finding } from '../findings.ts';
import { requestEdges } from '../failure/dependencyGraph.ts';
import { relationshipKind } from '../architecture/relationships.ts';
import { AWS_SERVICES } from '../../data/serviceCatalog.ts';

const SERVICE_BY_ID = new Map(AWS_SERVICES.map(s => [s.id, s]));

/** The `ProtocolType` union's own members. Some reference diagrams deliberately label an edge
 *  with a free-text string outside this union (e.g. "Replication" for RDS Multi-AZ sync, "S3 API"
 *  for a VPC Gateway Endpoint hop) to represent a specific mechanism the 9 standard categories
 *  don't capture - that's an intentional escape hatch, not a mismatch, so this check only applies
 *  to edges using one of the standard categories. */
const KNOWN_PROTOCOLS = new Set<string>(['HTTPS', 'HTTP', 'DNS', 'SQL', 'gRPC', 'TCP', 'Event', 'Message', 'Object access']);

/**
 * Protocol/target compatibility. `AWSService.inputs` in the service catalog already models which
 * protocols a given service plausibly accepts (e.g. RDS: ['SQL'], SQS: ['Message'], S3: ['HTTPS',
 * 'Object access']) - this reuses that curated data rather than inventing a second compatibility
 * table. An empty/undefined `inputs` means the catalog makes no claim for that service, so it's
 * left unflagged rather than guessed at (see CLAUDE.md: don't invent AWS semantics).
 *
 * `protocol` here is this simulator's own educational abstraction (see `ProtocolType`), not a
 * literal AWS wire protocol - so a finding means "this connection's label doesn't match how this
 * service is modeled to communicate," not "AWS would refuse this packet."
 */
export function validateProtocolCompatibility(
  nodes: Node<ServiceNodeData>[],
  edges: Edge<ConnectionData>[]
): Finding[] {
  const findings: Finding[] = [];
  const byId = new Map(nodes.map(n => [n.id, n]));

  for (const edge of requestEdges(edges)) {
    const kind = relationshipKind(edge.data);
    if (kind !== 'request' && kind !== 'dependency') continue; // protocol is meaningless for manages/route-association/target-registration edges

    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target || source.type === 'boundaryNode' || target.type === 'boundaryNode') continue;

    const contract = checkConnection(source, target, edge.data);
    if (contract.status === 'invalid') findings.push(makeFinding('validation', 'connection_contract', {
      severity: 'HIGH', resource: `${source.data.label} -> ${target.data.label}`, resourceId: edge.id,
      problem: contract.reason, whyItMatters: 'Unsupported interactions are rejected by live simulation.',
      awsRule: 'Service API interactions and network forwarding are distinct; consult the connection contract coverage.',
      recommendation: 'Choose a supported interaction in the connection inspector.'
    }));

    // `isCriticalDependency: false` already marks an edge as describing configuration, artifact
    // flow, or telemetry rather than live request/response traffic (see courseLabsAdvanced.ts) -
    // protocol compatibility is a claim about how a target receives *requests*, so it doesn't
    // apply here.
    if (edge.data?.isCriticalDependency === false) continue;

    const protocol = edge.data?.protocol;
    if (!protocol || !KNOWN_PROTOCOLS.has(protocol)) continue;

    const targetService = SERVICE_BY_ID.get(target.data.serviceId);
    const expected = targetService?.inputs;
    if (!expected || expected.length === 0) continue; // catalog makes no claim for this target - unknown, not wrong
    if (expected.includes(protocol)) continue;

    const expectedList = expected.join(' or ');
    findings.push(makeFinding('validation', 'protocol', {
      severity: 'MEDIUM',
      resource: `${source.data.label} -> ${target.data.label}`,
      resourceId: edge.id,
      problem: `${source.data.label} -> ${target.data.label} is labeled "${protocol}", but ${target.data.label} is modeled as accepting ${expectedList}.`,
      whyItMatters: `Protocol/interaction drives how the request simulation and its explanation describe this hop. A label that doesn't match how ${target.data.label} actually communicates will produce a misleading trace, even if the connection itself is geometrically and structurally valid.`,
      awsRule: `${target.data.label}'s service profile (src/data/serviceCatalog.ts) models its accepted inbound protocol(s) as ${expectedList}.`,
      recommendation: `Open this connection's inspector and set Protocol / Interaction to ${expectedList}, or confirm this pairing is intentional.`
    }));
  }

  return findings;
}
