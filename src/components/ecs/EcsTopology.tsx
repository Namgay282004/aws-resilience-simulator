import React from 'react';
import { Box, FileCode, Layers, MousePointer2, Network, Plus, Server, Cloud, ArrowDown } from 'lucide-react';
import type { Node } from '@xyflow/react';
import type { ServiceNodeData } from '../../types/index.ts';
import { ecsConfiguration } from '../../engine/service/models/ecs.ts';
import type { EcsWorkspace } from './EcsExplorer.tsx';

export type EcsSection = 'cluster' | 'service' | 'definition' | 'tasks' | 'compute' | 'network' | 'container';
interface Props {
  services: Node<ServiceNodeData>[];
  originId: string;
  selectedId: string;
  section: EcsSection | null;
  containerIndex: number | null;
  onSelect: (serviceId: string, section: EcsSection, containerIndex?: number) => void;
}
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-circuit-600';
const safeCount = (value: number) => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

/** A schematic of the saved service snapshots, not scheduler placement or live task identities. */
export function EcsTopology({ services, originId, selectedId, section, containerIndex, onSelect }: Props) {
  const origin = services.find(s => s.id === originId)!;
  const clusterName = origin.data.customConfig?.ecsWorkspace?.clusterName || 'Cluster · unnamed';
  const selected = (id: string, part: EcsSection) => id === selectedId && part === section;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
      <span className="inline-flex items-center gap-2"><MousePointer2 size={15} aria-hidden="true" />Select any component to configure it</span>
      <span>Logical view · observed task counts</span>
    </div>
    <section aria-label="ECS cluster boundary" className={`border-2 rounded-xl bg-white/70 overflow-hidden ${section === 'cluster' ? 'border-circuit-600' : 'border-slate-400'}`}>
      <button onClick={() => onSelect(originId, 'cluster')} aria-pressed={section === 'cluster'} className={`w-full flex items-center gap-3 p-4 text-left bg-slate-100 hover:bg-circuit-50 ${focus}`}>
        <Layers size={26} className="text-circuit-700 shrink-0" aria-hidden="true" />
        <span className="min-w-0"><span className="block text-xs text-slate-600">Amazon ECS cluster</span><span className="block font-semibold break-words">{clusterName}</span></span>
        <span className="ml-auto text-xs text-slate-600 shrink-0">{services.length} {services.length === 1 ? 'service' : 'services'}</span>
      </button>
      <div className="p-3 sm:p-5 space-y-5" aria-label="Cluster services">
        {services.map(service => {
          const data = service.data;
          const workspace: EcsWorkspace = data.customConfig?.ecsWorkspace ?? {};
          const config = ecsConfiguration(data);
          const running = safeCount(config.runningCount ?? data.replicas ?? 1);
          const desired = config.desiredCount ?? data.replicas ?? 1;
          const fargate = config.launchType === 'FARGATE';
          const containers = workspace.containers ?? [];
          return <section key={service.id} aria-label={`Service boundary: ${workspace.serviceName || data.label}`} className={`border-2 rounded-lg overflow-hidden ${selected(service.id, 'service') ? 'border-circuit-600' : 'border-circuit-200'}`}>
            <button aria-label={`Configure service ${workspace.serviceName || data.label}`} aria-pressed={selected(service.id, 'service')} onClick={() => onSelect(service.id, 'service')} className={`w-full p-4 bg-circuit-50 hover:bg-circuit-100 text-left flex flex-wrap items-center gap-3 ${focus}`}>
              <Layers size={21} className="text-circuit-700" aria-hidden="true" />
              <span className="min-w-0 flex-1"><span className="block text-xs text-circuit-800">ECS service</span><strong className="block break-words">{workspace.serviceName || data.label}</strong></span>
              <span className="text-xs px-2 py-1 border border-circuit-200 rounded bg-white">{fargate ? 'Fargate' : 'EC2'}</span>
              <span className="text-xs text-slate-600">{running} running / {desired} desired</span>
            </button>
            <div className="p-3 sm:p-4 bg-white space-y-3">
              <button onClick={() => onSelect(service.id, 'definition')} aria-pressed={selected(service.id, 'definition')} className={`w-full min-h-11 p-3 border border-dashed rounded text-left flex gap-2 items-center hover:bg-slate-50 ${selected(service.id, 'definition') ? 'border-circuit-600 bg-circuit-50' : 'border-slate-400'} ${focus}`}>
                <FileCode size={19} className="shrink-0 text-slate-600" aria-hidden="true" /><span className="text-sm break-words"><strong>{workspace.family || 'Task definition · not configured'}</strong><span className="block text-xs text-slate-500">Blueprint · {containers.length} container definitions</span></span>
              </button>
              <p className="flex items-center gap-2 text-xs text-slate-500"><ArrowDown size={14} aria-hidden="true" />Describes the containers in each task · schematic only</p>
              <div className="grid sm:grid-cols-2 gap-3" aria-label={`Task snapshots for ${data.label}`}>
                {Array.from({ length: Math.min(running, 6) }, (_, task) => <section key={task} aria-label={`Task snapshot ${task + 1}`} className={`rounded-lg border overflow-hidden ${selected(service.id, 'tasks') ? 'border-circuit-600' : 'border-slate-300'}`}>
                  <button onClick={() => onSelect(service.id, 'tasks')} aria-pressed={selected(service.id, 'tasks')} className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 min-h-11 bg-slate-100 hover:bg-slate-200 ${focus}`}>
                    <span className="flex items-center gap-2 text-sm font-semibold"><Box size={17} aria-hidden="true" />Task {task + 1}</span><span className="text-xs text-slate-600">Snapshot</span>
                  </button>
                  <div className="p-3 space-y-2 bg-slate-50/50">
                    {containers.map((container, index) => <button key={index} aria-label={`Configure container ${container.name || index + 1} in task ${task + 1} of ${workspace.serviceName || data.label}`} aria-pressed={selected(service.id, 'container') && index === containerIndex} onClick={() => onSelect(service.id, 'container', index)} className={`w-full min-h-16 p-3 rounded border text-left hover:border-circuit-600 ${selected(service.id, 'container') && index === containerIndex ? 'bg-circuit-50 border-circuit-600' : 'bg-white border-slate-300'} ${focus}`}>
                      <span className="flex items-center gap-2 text-sm font-medium"><Box size={20} className="text-circuit-700 shrink-0" aria-hidden="true" /><span className="break-all">{container.name || `Container ${index + 1}`}</span></span>
                      <span className="block text-xs text-slate-500 mt-1">Container{container.port ? ` · port ${container.port}` : ''}</span>
                      <span className="block text-xs text-slate-600 truncate mt-1" title={container.image}>{container.image || 'Image not configured'}</span>
                    </button>)}
                    {!containers.length && <button onClick={() => onSelect(service.id, 'definition')} className={`w-full min-h-20 p-3 border border-dashed rounded border-slate-300 text-left text-xs text-slate-600 hover:bg-white ${focus}`}><Plus size={18} className="mb-2" aria-hidden="true" />Define the containers inside this task</button>}
                  </div>
                </section>)}
              </div>
              {running === 0 && <div className="p-5 border border-dashed border-slate-300 rounded text-center"><Box size={24} className="mx-auto mb-2 text-slate-400" aria-hidden="true" /><p className="text-sm font-medium">No observed running tasks</p><p className="text-xs text-slate-500 mt-1">Desired count: {desired}. Configure the service snapshot to change observed tasks.</p></div>}
              {running > 6 && <button onClick={() => onSelect(service.id, 'tasks')} className={`text-sm text-circuit-700 underline min-h-11 ${focus}`}>+ {running - 6} more tasks · showing 6 of {running}</button>}
              <div className="border-t border-dashed border-slate-300 pt-3">
                <button onClick={() => onSelect(service.id, 'compute')} aria-pressed={selected(service.id, 'compute')} className={`w-full p-3 rounded text-left border ${selected(service.id, 'compute') ? 'border-circuit-600 bg-circuit-50' : fargate ? 'border-sky-200 bg-sky-50' : 'border-orange-200 bg-orange-50'} ${focus}`}>
                  <span className="flex items-center gap-2 text-sm font-semibold">{fargate ? <Cloud size={20} aria-hidden="true" /> : <Server size={20} aria-hidden="true" />}{fargate ? 'Fargate · AWS-managed compute' : 'EC2 · container instances'}</span>
                  <span className="block text-xs text-slate-600 mt-1">{fargate ? 'Managed task compute · no customer-managed hosts' : `${workspace.instanceCount || 'Unspecified'} hosts · ${workspace.instanceType || 'instance type not configured'} · placement not modeled`}</span>
                </button>
              </div>
              <button onClick={() => onSelect(service.id, 'network')} aria-pressed={selected(service.id, 'network')} className={`w-full text-left min-h-11 px-3 py-2 border rounded text-xs flex gap-2 items-center hover:bg-slate-50 ${selected(service.id, 'network') ? 'border-circuit-600 bg-circuit-50' : 'border-slate-200'} ${focus}`}><Network size={17} aria-hidden="true" />{config.networkMode || 'awsvpc'} task networking · {data.subnet} · {(data.securityGroupIds ?? []).length} security groups</button>
            </div>
          </section>;
        })}
      </div>
    </section>
    <p className="text-xs text-slate-500">Task boxes illustrate the observed count and saved container blueprint. They are not live task IDs or verified running container instances.</p>
  </div>;
}
