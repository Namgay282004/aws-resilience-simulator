import { isDependencyCall, relationshipKind } from '../architecture/relationships.ts';
import type { Node, Edge } from '@xyflow/react';
import type { ServiceNodeData, ConnectionData, SimulationScenario, SimulationResult } from '../../types/index.ts';
import type { RequestTrace } from '../trace/types.ts';
import { runSimulation } from './requestSimulator.ts';

/** The UI executes this entry point. Explanations are immutable run evidence, never a second run. */
export function runLiveSimulation(nodes: Node<ServiceNodeData>[], edges: Edge<ConnectionData>[], scenario: SimulationScenario): SimulationResult {
  const result = runSimulation(nodes, edges, scenario, { enforceIam: true });
  if (edges.some(edge => isDependencyCall(edge.data))) {
    result.summary += ' Scope: the forwarding path and supported dependency calls were evaluated; other dependency-only arrows were not executed.';
  }
  if (edges.some(edge => ['manages', 'route-association', 'target-registration'].includes(relationshipKind(edge.data)))) {
    result.summary += ' Scope: structural relationships do not carry requests; their control-plane behavior is not yet simulated.';
  }
  return result;
}

export function traceFromSimulation(result: SimulationResult): RequestTrace {
  return {
    entries: result.steps.map((step, index) => step.details?.decision
      ? { ...step.details.decision, order: index + 1,
          metadata: { ...step.details.decision.metadata, stepId: step.id, timestampMs: step.timestampMs } }
      : {
          order: index + 1, component: 'Service', resource: step.targetNodeName,
          operation: step.action, input: { source: step.sourceNodeId, destination: step.targetNodeId, protocol: step.protocol },
          decision: step.status === 'failed' ? 'FAILURE' : step.status === 'bypassed' ? 'INFO' : 'SUCCESS',
          reason: step.explanation, simpleExplanation: step.explanation,
          awsRule: 'Recorded simulator decision. This legacy stage does not yet provide a verified AWS rule reference.',
          metadata: { ...step.details, stepId: step.id, timestampMs: step.timestampMs, ruleReferenceAvailable: false }
        }),
    final: result.success ? 'SUCCESS' : 'DENIED', why: result.summary
  };
}
