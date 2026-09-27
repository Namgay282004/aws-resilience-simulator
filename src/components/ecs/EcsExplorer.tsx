import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MousePointer2, X, Plus, Trash2 } from 'lucide-react';
import type { Node, Edge } from '@xyflow/react';
import type { ServiceNodeData } from '../../types/index.ts';
import { ecsConfiguration } from '../../engine/service/models/ecs.ts';
import { EcsTopology, type EcsSection } from './EcsTopology.tsx';
import { EcsConnectivityMap } from './EcsConnectivityMap.tsx';
import { EcsConfigurationPanel } from '../inspector/EcsConfigurationPanel.tsx';

interface ContainerDefinition { name: string; image: string; port: string; essential: boolean }
export interface EcsWorkspace {
  instanceProfile?: string;
  repository?: string;
  clusterName?: string;
  serviceName?: string;
  family?: string;
  cpu?: string;
  memory?: string;
  executionRole?: string;
  taskRole?: string;
  logGroup?: string;
  instanceType?: string;
  instanceCount?: string;
  containers?: ContainerDefinition[];
}
const control = 'w-full mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-circuit-600';
const button = 'min-h-11 px-3 py-2 rounded-md border border-slate-300 hover:bg-slate-50 focus-visible:outline-circuit-600 text-sm';

export function EcsExplorer({ nodeId, nodes, edges, onUpdate, onClose }: {
  nodeId: string; nodes: Node<ServiceNodeData>[]; edges: Edge[];
  onUpdate: (id: string, data: Partial<ServiceNodeData>) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const [serviceId, setServiceId] = useState(nodeId);
  const [section, setSection] = useState<EcsSection | null>(null);
  const [containerIndex, setContainerIndex] = useState<number | null>(null);
  const origin = nodes.find(n => n.id === nodeId)!;
  const originWorkspace: EcsWorkspace = origin.data.customConfig?.ecsWorkspace ?? {};
  const services = nodes.filter(n => n.data.serviceId === 'ecs' && (n.id === nodeId || (originWorkspace.clusterName && n.data.customConfig?.ecsWorkspace?.clusterName === originWorkspace.clusterName)));
  const node = services.find(n => n.id === serviceId) ?? origin;
  const data = node.data;
  const workspace: EcsWorkspace = data.customConfig?.ecsWorkspace ?? {};
  const config = ecsConfiguration(data);
  const containers = workspace.containers ?? [];
  const running = config.runningCount ?? data.replicas ?? 1;
  const desired = config.desiredCount ?? data.replicas ?? 1;
  const launchType = config.launchType ?? 'EC2';
  const update = (patch: Partial<EcsWorkspace>) => onUpdate(node.id, { customConfig: { ...data.customConfig, ecsWorkspace: { ...workspace, ...patch } } });
  const connections = edges.filter(e => e.source === node.id || e.target === node.id);
  const parent = nodes.find(n => n.id === node.parentId);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const field = (label: string, key: keyof Omit<EcsWorkspace, 'containers'>, placeholder = '') => <label className="block text-sm font-medium">{label}
    <input className={control} value={workspace[key] ?? ''} placeholder={placeholder} onChange={e => update({ [key]: e.target.value })} />
  </label>;
  const titles: Record<EcsSection, string> = { cluster: 'Cluster', service: 'Service configuration', definition: 'Task definition', tasks: 'Task snapshot', compute: 'Compute capacity', network: 'Networking & connections', container: 'Container configuration' };
  return createPortal(<div className="fixed inset-0 z-[11000] bg-slate-900/60 p-2 sm:p-6 flex items-center justify-center" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="ecs-explorer-title" tabIndex={-1}
      className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[92dvh] flex flex-col overflow-hidden text-slate-900"
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        if (e.key === 'Tab') {
          const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], textarea:not(:disabled)');
          if (!items?.length) return;
          const first = items[0], last = items[items.length - 1];
          if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first.focus(); }
        }
      }}>
      <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div><p className="text-xs text-slate-500 mb-1">Architecture / Amazon ECS</p><h2 id="ecs-explorer-title" className="text-xl font-semibold">Inside {origin.data.label}</h2></div>
        <button className={button} onClick={onClose} aria-label="Close ECS explorer"><X size={20} /></button>
      </header>
      <div className="px-5 py-3 bg-slate-50 border-b text-xs text-slate-600">Explore the components, then edit their details. Changes save to this architecture immediately. Each canvas ECS node represents one service; matching cluster names group services here.</div>
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 p-4 sm:p-6 lg:overflow-y-auto bg-slate-50" style={{ backgroundImage: 'radial-gradient(#cbd5e1 0.7px, transparent 0.7px)', backgroundSize: '18px 18px' }}>
          <EcsTopology services={services} originId={nodeId} selectedId={node.id} section={section} containerIndex={containerIndex} onSelect={(id, part, index) => { setServiceId(id); setSection(part); setContainerIndex(index ?? null); }} />
        </main>
        <aside aria-label="ECS component details" className="border-t lg:border-t-0 lg:border-l border-slate-200 p-5 space-y-5 lg:overflow-y-auto">
          <EcsConnectivityMap services={services} nodes={nodes} edges={edges} clusterName={originWorkspace.clusterName || 'unnamed'} onSelectService={id => { setServiceId(id); setSection('network'); setContainerIndex(null); }} />
          <div className="flex items-start justify-between gap-2"><div><p className="text-xs text-circuit-700 font-semibold mb-1">Component details</p><h3 className="text-lg font-semibold">{section ? titles[section] : 'Explore your cluster'}</h3></div>{section && <button className={button} onClick={() => setSection(null)} aria-label="Close component details"><X size={16} /></button>}</div>
          {!section && <div className="py-8 text-sm text-slate-600 space-y-3"><MousePointer2 size={28} className="text-circuit-700" aria-hidden="true" /><p>Select a cluster, service, task, or container in the diagram.</p><p>Its configuration opens here, keeping the architecture in view.</p></div>}
          {section && <p className="text-xs text-slate-500 break-words">{workspace.clusterName || 'Unnamed cluster'} / {workspace.serviceName || data.label}{section === 'container' ? ` / ${containers[containerIndex ?? -1]?.name || 'Container'}` : ''}</p>}
          {section === 'cluster' && <>{field('Cluster name', 'clusterName', 'e.g. production')}<p className="text-sm text-slate-600">A cluster groups services and tasks. Give other ECS nodes the same cluster name to see them together. A cluster can contain EC2 and Fargate workloads.</p></>}
          {section === 'service' && <>{field('Service name', 'serviceName', data.label)}<EcsConfigurationPanel data={data} onChange={customConfig => onUpdate(node.id, { customConfig })} /><p className="text-xs text-slate-600">Task counts and launch type use the existing simulation model. Desired count does not automatically change the observed running count.</p></>}
          {(section === 'definition' || section === 'container') && <>
            <p className="text-xs text-amber-900 bg-amber-50 p-3 rounded border border-amber-200">Configuration only: this task definition is saved for design. Container startup, revisions, CPU/memory placement, role bindings, and logs are not simulated by these fields.</p>
            {section === 'definition' && <>{field('Task definition family', 'family', 'e.g. web-task')}
            <div className="grid grid-cols-2 gap-3">{field('CPU units', 'cpu', '256')}{field('Memory (MiB)', 'memory', '512')}</div>
            <p className="text-xs text-slate-600">Network mode: {config.networkMode || 'awsvpc'}. The current model supports awsvpc for both launch types.</p>
            {field('Task role ARN', 'taskRole')}{field('Task execution role ARN', 'executionRole')}{field('CloudWatch log group', 'logGroup')}</>}
            <h4 className="font-semibold text-sm">{section === 'container' ? 'Edit shared container definition' : 'Container definitions'}</h4>
            {section === 'container' && <p className="text-xs text-slate-600">These edits change the blueprint shown in every task of this service.</p>}
            {containers.length === 0 && <p className="text-sm text-slate-500">Add a container to describe what runs inside a task.</p>}
            {containers.map((c, i) => (section === 'definition' || i === containerIndex) && <fieldset key={i} className="border rounded-lg p-3 space-y-3"><legend className="text-sm px-1">Container {i + 1}</legend>
              {(['name', 'image', 'port'] as const).map(key => <label key={key} className="block text-sm">{{ name: 'Container name', image: 'Image URI', port: 'Container port' }[key]}<input className={control} value={c[key]} onChange={e => update({ containers: containers.map((item, j) => j === i ? { ...item, [key]: e.target.value } : item) })} /></label>)}
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={c.essential} onChange={e => update({ containers: containers.map((item, j) => j === i ? { ...item, essential: e.target.checked } : item) })} />Essential container</label>
              <button className={button} onClick={() => { update({ containers: containers.filter((_, j) => j !== i) }); setSection('definition'); setContainerIndex(null); }}><Trash2 size={14} className="inline mr-2" />Remove container {i + 1}</button>
            </fieldset>)}
            <button className={button} onClick={() => { update({ containers: [...containers, { name: `container-${containers.length + 1}`, image: '', port: '', essential: true }] }); setSection('container'); setContainerIndex(containers.length); }}><Plus size={16} className="inline mr-2" />Add container</button>
            <a className="block text-sm text-circuit-700 underline" href="https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html" target="_blank" rel="noreferrer">AWS task definition requirements</a>
          </>}
          {section === 'tasks' && <><p className="text-sm">{running} observed running tasks; {desired} desired.</p><p className="text-sm text-slate-600">This is an aggregate service snapshot, not individual live AWS tasks. Task IDs, placement, startup, and scheduling are not modeled.</p><p className="text-sm">Service health: <strong>{data.health}</strong></p><button className={button} onClick={() => setSection('service')}>Configure task counts</button></>}
          {section === 'compute' && <><EcsConfigurationPanel data={data} onChange={customConfig => onUpdate(node.id, { customConfig })} />{launchType === 'EC2' ? <>{field('EC2 instance type', 'instanceType', 'e.g. t3.medium')}{field('Container instance count', 'instanceCount', 'e.g. 2')}<p className="text-xs text-slate-600">Design metadata only. Hosts are not provisioned and task placement or capacity is not calculated.</p></> : <p className="text-sm text-slate-600">Fargate provides managed compute for your tasks. Configure task size and containers in the task definition.</p>}</>}
          {section === 'network' && <>
            <dl className="text-sm space-y-3"><div><dt className="text-slate-500">Canvas placement</dt><dd>{parent?.data.label || 'No parent boundary'} · {data.subnet} · {data.az}</dd></div><div><dt className="text-slate-500">Attached security groups</dt><dd>{(data.securityGroupIds ?? []).map(id => nodes.find(n => n.id === id)?.data.label || id).join(', ') || 'None attached'}</dd></div></dl>
            <p className="text-xs text-slate-600">Edit subnet placement and security groups in the architecture inspector. Canvas links describe configured connections; they do not prove reachability.</p>
            <h4 className="font-semibold text-sm">Associated canvas components</h4>
            {connections.length === 0 && <p className="text-sm text-slate-500">No connected components. Connect resources on the architecture canvas.</p>}
            {connections.map(e => { const incoming = e.target === node.id; const other = nodes.find(n => n.id === (incoming ? e.source : e.target)); return <div key={e.id} className="border rounded p-3 text-sm"><span className="text-xs text-slate-500">{incoming ? 'Incoming from' : 'Outgoing to'}</span><p className="font-medium break-words">{other?.data.label || 'Missing component'}</p><p className="text-xs text-slate-600">{String(e.data?.protocol || 'Unspecified protocol')}</p></div>; })}
          </>}
        </aside>
      </div>
    </div>
  </div>, document.body);
}
