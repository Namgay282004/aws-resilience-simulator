import type { Node, Edge } from '@xyflow/react';
import type { ServiceNodeData, ConnectionData, SimulationScenario } from '../types/index.ts';
import type { Principal } from '../engine/iam/types.ts';

export interface LabReference {
  id: string;
  title: string;
  description: string;
  expected: string;
  simulationScope?: string;
  nodes: Node<ServiceNodeData>[];
  edges: Edge<ConnectionData>[];
  scenario: SimulationScenario;
  configurationChecks?: LabConfigurationCheck[];
  authorization?: { principal: Principal; action: string; resourceArn: string };
}
export interface CourseLab {
  id: string;
  number: number;
  title: string;
  sourceUrl: string;
  objectives: string[];
  limitations: string;
  references: LabReference[];
}

/** A bounded course configuration assertion; never evidence of runtime execution. */
export interface LabConfigurationCheck {
  id: string;
  nodeId: string;
  path: string[];
  operator: 'equals' | 'includes' | 'numberedVersion' | 'connection';
  expected?: unknown;
  otherNodeId?: string;
  otherPath?: string[];
  reason: string;
  source: string;
}
