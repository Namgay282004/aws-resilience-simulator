import { isVpcEndpoint } from '../../network/vpcEndpoint.ts';
import type { AdapterContext, AdapterSignal } from './types.ts';
import { CONTINUE, TERMINATE } from './types.ts';

const TERMINAL_DATA_STORE_SERVICE_IDS = ['rds', 'dynamodb', 's3', 'elasticache', 'aurora'];

/**
 * Structural, not service-specific: a node with zero outgoing edges is the end of the line for
 * this request, whatever it is. Runs after the WAF/auto-scaling/NAT checks (which can still
 * apply to a terminal node, e.g. a standalone NAT Gateway) and before anything that needs
 * `downstreamNodes` to be meaningful.
 */
export const terminalNodeAdapter = (ctx: AdapterContext): AdapterSignal => {
  const { trace, node, outgoingEdges } = ctx;

  if (outgoingEdges.length !== 0) {
    return CONTINUE;
  }

  if (isVpcEndpoint(node.data)) {
    trace.fail(400, 'A VPC endpoint needs a connection to its configured destination service; it does not process application requests itself.');
    trace.pushStep({ sourceNodeId: node.id, targetNodeId: node.id,
      sourceNodeName: node.data.label, targetNodeName: node.data.label,
      protocol: 'HTTPS', action: 'Missing endpoint destination', status: 'failed',
      explanation: 'Connect this endpoint to its configured service.', targetHealth: node.data.health, latencyMs: 0 });
    return TERMINATE;
  }

  const isTerminalDataStore = TERMINAL_DATA_STORE_SERVICE_IDS.includes(node.data.serviceId);
  trace.pushStep({
    sourceNodeId: node.id,
    targetNodeId: node.id,
    sourceNodeName: node.data.label,
    targetNodeName: node.data.label,
    protocol: isTerminalDataStore ? 'SQL' : 'HTTP',
    action: isTerminalDataStore ? 'Query Completed' : 'Terminal Processing Done',
    status: 'success',
    explanation: isTerminalDataStore
      ? `${node.data.label} committed transaction and returned data.`
      : `${node.data.label} completed terminal execution.`,
    targetHealth: node.data.health,
    latencyMs: isTerminalDataStore ? 25 : 10
  });
  trace.advanceTime(25);
  return TERMINATE;
};
