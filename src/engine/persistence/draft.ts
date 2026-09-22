import { CURRENT_RELEASE } from '../releases/release.ts';
import type { Node, Edge, Viewport } from '@xyflow/react';
import type { ServiceNodeData, ConnectionData, SimulationScenario, SimulationResult, AppMode } from '../../types/index.ts';
import type { Failure } from '../failure/index.ts';
import type { LabReference } from '../../data/courseLabs.ts';
export const DRAFT_KEY = 'aws-architecture-lab.draft.v1';
export interface DraftState {
  nodes: Node<ServiceNodeData>[]; edges: Edge<ConnectionData>[];
  scenario: SimulationScenario; simulationResult: SimulationResult | null;
  activeFailures: Failure[]; activeLabReference: LabReference | null;
  activeChallengeId: string | null;
  challengeResult: { passed: boolean; feedback: string[]; score: number } | null;
  appMode: AppMode; selectedNodeId: string | null; selectedEdgeId: string | null;
  activeStepIndex: number | null; playbackSpeed: number; highlightTaskFlow: boolean;
  showNaclSideColumn: boolean; viewport: Viewport | null;
}
export function serializeDraft(state: DraftState): string {
  return JSON.stringify({ format: 'aws-architecture-lab', version: 2, applicationRelease: CURRENT_RELEASE, savedAt: new Date().toISOString(), state }, null, 2);
}
export function parseDraft(text: string): DraftState {
  if (text.length > 20_000_000) throw new Error('Draft exceeds the 20 MB import limit.');
  const doc = migrateDraft(JSON.parse(text));
  const s = doc?.state;
  const object = (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const finite = (v: any) => typeof v === 'number' && Number.isFinite(v);
  if (doc?.format !== 'aws-architecture-lab' || doc.version !== 2) throw new Error('Unsupported draft format or version.');
  if (!object(s) || !Array.isArray(s.nodes) || !Array.isArray(s.edges) ||
      !s.nodes.every((n: any) => object(n) && typeof n.id === 'string' && object(n.data) && object(n.position) && finite(n.position.x) && finite(n.position.y)) ||
      !s.edges.every((e: any) => object(e) && typeof e.id === 'string' && typeof e.source === 'string' && typeof e.target === 'string') ||
      !object(s.scenario) || typeof s.scenario.path !== 'string' || typeof s.scenario.method !== 'string' ||
      !Array.isArray(s.activeFailures) || !s.activeFailures.every((f: any) => object(f) && typeof f.id === 'string' && typeof f.targetResourceId === 'string' && typeof f.failureType === 'string' && Array.isArray(f.affectedDependencies)) ||
      !['design', 'simulate', 'failure', 'analyze', 'compare', 'challenges'].includes(s.appMode) ||
      ![s.selectedNodeId, s.selectedEdgeId, s.activeChallengeId].every((id: any) => id === null || typeof id === 'string') ||
      !(s.challengeResult === null || (object(s.challengeResult) && typeof s.challengeResult.passed === 'boolean' && Array.isArray(s.challengeResult.feedback) && finite(s.challengeResult.score))) ||
      !finite(s.playbackSpeed) || s.playbackSpeed <= 0 ||
      typeof s.highlightTaskFlow !== 'boolean' || typeof s.showNaclSideColumn !== 'boolean' ||
      !(s.activeStepIndex === null || Number.isInteger(s.activeStepIndex)) ||
      !(s.viewport === null || (object(s.viewport) && finite(s.viewport.x) && finite(s.viewport.y) && finite(s.viewport.zoom) && s.viewport.zoom > 0)) ||
      !(s.simulationResult === null || (object(s.simulationResult) && Array.isArray(s.simulationResult.steps) && Array.isArray(s.simulationResult.path))) ||
      !(s.activeLabReference === null || (object(s.activeLabReference) && Array.isArray(s.activeLabReference.nodes) && Array.isArray(s.activeLabReference.edges)))) {
    throw new Error('Invalid draft data. Current work has not been changed.');
  }
  const ids = new Set(s.nodes.map((n: any) => n.id));
  if (ids.size !== s.nodes.length || new Set(s.edges.map((e: any) => e.id)).size !== s.edges.length ||
      s.edges.some((e: any) => !ids.has(e.source) || !ids.has(e.target))) throw new Error('Draft has duplicate IDs or connections to missing nodes.');
  if (s.activeStepIndex !== null && (!s.simulationResult || s.activeStepIndex < 0 || s.activeStepIndex >= s.simulationResult.steps.length)) throw new Error('Invalid simulation playback position.');
  return s as DraftState;
}

/** Version 1 stored the same workspace fields, without release metadata. Keep the original state intact. */
export function migrateDraft(doc: any): any {
  if (doc?.format !== 'aws-architecture-lab' || ![1, 2].includes(doc.version)) {
    throw new Error('Unsupported draft format or version. Keep this file and open it with a compatible release.');
  }
  if (doc.version === 1) return { ...doc, version: 2, applicationRelease: null };
  return doc;
}
