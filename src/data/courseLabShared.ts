import type { Node, Edge } from '@xyflow/react';
import type { ServiceNodeData, ConnectionData, SimulationScenario } from '../types/index.ts';
import type { Principal } from '../engine/iam/types.ts';
import { AWS_SERVICES } from './serviceCatalog.ts';

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

export const root = 'https://norbutlepcha25.github.io/dso303/Lab/';
export const node = (id: string, serviceId: string, label: string, x: number, y: number, extra: Partial<ServiceNodeData> = {}): Node<ServiceNodeData> => ({
  id, type: 'serviceNode', position: { x, y }, data: { serviceId, label, category: AWS_SERVICES.find(service => service.id === serviceId)?.category ?? 'Compute', health: 'healthy', az: extra.subnet === 'public' || extra.subnet === 'private' || serviceId === 'ebs' ? 'AZ-A' : 'Edge / Global', subnet: 'global', replicas: 1, multiAz: false, ...extra }
});
export const boundary = (id: string, label: string, kind: string, x: number, y: number, width: number, height: number, extra = {}): Node<ServiceNodeData> => ({
  id, type: 'boundaryNode', position: { x, y }, style: { width, height }, data: { label, boundaryType: kind, width, height, ...extra } as unknown as ServiceNodeData
});
export const edge = (source: string, target: string, protocol: ConnectionData['protocol'] = 'HTTP', dependency = false): Edge<ConnectionData> => ({
  id: `${source}-${target}`, source, target, type: 'custom', data: { protocol, interactionType: 'synchronous', isCriticalDependency: true, timeoutMs: 1500, ...(dependency ? { traversal: 'dependency' as const } : {}) }
});
export const scenario = (id: string, startNodeId: string): SimulationScenario => ({ id, name: id, method: 'GET', path: '/', startNodeId, trafficLevel: 'normal' });

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
