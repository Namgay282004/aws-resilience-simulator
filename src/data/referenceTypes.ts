import type { Node, Edge } from '@xyflow/react';
import type { SimulationScenario } from '../types/index.ts';
export interface ReferenceArchitecture {
  id: string;
  name: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  learningOutcome: string;
  scenario?: SimulationScenario;
  nodes: Node<any>[];
  edges: Edge<any>[];
}

