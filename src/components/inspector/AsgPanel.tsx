import React, { useEffect, useState } from 'react';
import { useArchitecture } from '../../context/ArchitectureContext.tsx';
import { advanceAsg, resetAsg, defaultAsgConfig, type AsgConfig, type AsgRuntime } from '../../engine/scaling/asg.ts';

export function AsgPanel() {
  const { selectedNode, nodes, effectiveNodes, edges, setNodes, setEdges, updateNodeData } = useArchitecture();
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const group = selectedNode?.data.serviceId === 'ec2_auto_scaling' ? selectedNode : nodes.find(n => n.data.serviceId === 'ec2_auto_scaling' && n.data.customConfig?.asg?.alarmId === selectedNode?.id);
  const config: AsgConfig = { ...defaultAsgConfig, ...group?.data.customConfig?.asg };
  const runtime = group?.data.customConfig?.asgRuntime as AsgRuntime | undefined;
  const alarm = nodes.find(n => n.id === config.alarmId);
  const tick = () => {
    if (!group || config.metricSource === 'alb') return;
    try {
      const value = alarm?.data.customConfig?.metricValue;
      const result = advanceAsg(effectiveNodes, edges, group.id, value === '' || value === undefined ? undefined : Number(value));
      // Failure overrides are inputs only, never persisted as base health.
      setNodes(result.nodes.map(n => { const original = nodes.find(o => o.id === n.id); return original ? { ...n, data: { ...n.data, health: original.data.health } } : n; }));
      setEdges(result.edges); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setPlaying(false); }
  };
  useEffect(() => { if (!playing) return; const timer = window.setInterval(tick, 1500); return () => window.clearInterval(timer); }, [playing, nodes, edges, effectiveNodes, group?.id]);
  useEffect(() => { if (!runtime) setPlaying(false); }, [runtime]);
  if (!group) return <p className="text-xs text-slate-600">To drive EC2 scaling, select an ASG and choose this CloudWatch node as its dedicated scaling alarm.</p>;
  const update = (patch: Partial<AsgConfig>) => {
    const next = { ...config, ...patch };
    updateNodeData(group.id, { customConfig: { ...group.data.customConfig, asg: next } });
    if (next.metricSource === 'alb' && next.loadBalancerId && next.alarmId) setEdges(previous => {
      const retained = previous.filter(e => !e.data?.asgMonitoringFor || e.data.asgMonitoringFor !== group.id);
      if (retained.some(e => e.source === next.loadBalancerId && e.target === next.alarmId && e.data?.relationship === 'manages')) return retained;
      return [...retained, { id: `asg-monitor-${group.id}`, type: 'custom', source: next.loadBalancerId!, target: next.alarmId, data: { protocol: 'Event', interactionType: 'event', isCriticalDependency: false, timeoutMs: 3000, relationship: 'manages', label: 'ALB request metrics', asgMonitoringFor: group.id } }];
    });
  };
  const select = (label: string, key: 'templateId' | 'alarmId' | 'loadBalancerId', ids: string[]) => <label className="block">{label}<select disabled={!!runtime} className="block w-full border p-2 rounded" value={config[key] ?? ''} onChange={e => update({ [key]: e.target.value })}><option value="">Select…</option>{nodes.filter(n => ids.includes(n.data.serviceId)).map(n => <option key={n.id} value={n.id}>{n.data.label}</option>)}</select></label>;
  const button = 'border rounded px-3 py-2 min-h-11 hover:bg-slate-100';
  return <section className="p-3 border rounded space-y-3 text-xs" aria-label="ASG scaling simulation">
    <h3 className="font-bold">{group.data.label} · EC2 scaling</h3>
    <p>{config.metricSource === 'alb' ? 'Canvas-driven scaling: Send Request through the linked ALB to evaluate a synthetic one-minute traffic batch. No scaling playback or overlay is needed.' : 'Manual metric experiment.'}</p>
    {config.metricSource !== 'alb' && <p>Simple scale-out policy. Each tick samples the configured metric once and advances {config.period}s. Play accelerates simulated time; it does not collect real CPU metrics. Missing samples produce INSUFFICIENT_DATA.</p>}
    {config.metricSource === 'alb' && <p>One Send Request = one synthetic minute: Low 30, Normal 120, High 240, Very high 600, 10× 1,200, 100× 12,000 requests. Metric = requests / healthy ASG targets. Target tracking uses an illustrative proportional calculation, not AWS’s internal controller.</p>}
    <fieldset disabled={!!runtime} className="space-y-2">
      <label className="block">Metric source<select aria-label="Scaling metric source" className="block border rounded p-2 w-full" value={config.metricSource ?? 'manual'} onChange={e => update({ metricSource: e.target.value as 'manual' | 'alb', period: 60, policyType: 'simple' })}><option value="alb">Connected ALB request traffic</option><option value="manual">Manual metric sample</option></select></label>
      <label className="block">Policy type<select aria-label="Scaling policy type" className="block border rounded p-2 w-full" value={config.policyType ?? 'simple'} onChange={e => update({ policyType: e.target.value as 'simple' | 'target', targetValue: config.targetValue ?? 50 })}><option value="simple">Simple scaling · fixed increment</option>{config.metricSource === 'alb' && <option value="target">Target tracking · illustrative, scale-out only</option>}</select></label>
      {config.policyType === 'target' && <label className="block">Target requests per healthy instance / minute<input className="block border p-2 w-full" type="number" min={1} value={config.targetValue ?? 50} onChange={e => update({ targetValue: Number(e.target.value) })} /></label>}
      {config.metricSource === 'alb' && select('Monitored ALB', 'loadBalancerId', ['alb'])}
      {selectedNode?.data.serviceId === 'cloudwatch' && <><label className="block">Instances added per simple scaling action<input type="number" min={1} value={config.adjustment} onChange={e => update({ adjustment: Number(e.target.value) })} /></label><label className="block">Consecutive breaching periods<input type="number" min={1} max={10} value={config.evaluationPeriods} onChange={e => update({ evaluationPeriods: Number(e.target.value) })} /></label></>}
    </fieldset>
    {selectedNode?.id === group.id && <fieldset disabled={!!runtime} className="space-y-2">
      {select('EC2 launch blueprint (inherits subnet, security groups and role)', 'templateId', ['ec2'])}
      {select('Dedicated CloudWatch alarm', 'alarmId', ['cloudwatch'])}
      {select('Load balancer (optional)', 'loadBalancerId', ['alb', 'nlb'])}
      <p>Initial EC2 members (one instance per node):</p>
      {nodes.filter(n => n.data.serviceId === 'ec2' && !n.data.customConfig?.asgInstance?.generated).map(n => <label className="block" key={n.id}><input type="checkbox" checked={config.memberIds.includes(n.id)} onChange={e => update({ memberIds: e.target.checked ? [...config.memberIds, n.id] : config.memberIds.filter(id => id !== n.id) })} /> {n.data.label}</label>)}
      {([['min', 'Minimum'], ['max', 'Maximum (≤20)'], ['adjustment', 'Instances added per alarm action'], ['evaluationPeriods', 'Consecutive breaching periods (1–10)'], ['period', 'Period seconds'], ['launchSeconds', 'Simulated launch seconds'], ['warmupSeconds', 'Warmup seconds'], ['cooldownSeconds', 'Simple policy cooldown seconds']] as const).map(([key, label]) => <label className="block" key={key}>{label}<input className="block border p-2 rounded w-full" type="number" min={0} value={config[key]} onChange={e => update({ [key]: Number(e.target.value) })} /></label>)}
    </fieldset>}
    {runtime && <p>Configuration locked during a run. Reset scaling to edit it.</p>}
    {alarm && config.policyType !== 'target' && <label className="block">Alarm threshold ≥<input className="border p-2 w-full" type="number" value={alarm.data.customConfig?.threshold ?? 80} onChange={e => updateNodeData(alarm.id, { customConfig: { ...alarm.data.customConfig, threshold: Number(e.target.value) } })} /></label>}
    {alarm && config.metricSource !== 'alb' && <label className="block">CloudWatch metric sample (blank = missing)<input className="border p-2 w-full" type="number" value={alarm.data.customConfig?.metricValue ?? ''} onChange={e => updateNodeData(alarm.id, { customConfig: { ...alarm.data.customConfig, metricValue: e.target.value === '' ? '' : Number(e.target.value) } })} /></label>}
    {alarm?.data.customConfig?.asgObservation && <p>Last canvas observation: {alarm.data.customConfig.asgObservation.requests} synthetic requests / {alarm.data.customConfig.asgObservation.targets} healthy targets = {alarm.data.customConfig.asgObservation.value === null ? 'missing' : Number(alarm.data.customConfig.asgObservation.value).toFixed(1)} requests/target/minute.</p>}
    <p>Alarm: {alarm?.data.customConfig?.asgAlarm?.state ?? 'INSUFFICIENT_DATA'} · Clock: {runtime?.now ?? 0}s · Desired: {runtime?.desired ?? Math.max(config.min, config.memberIds.length)}</p>
    <div className="flex flex-wrap gap-2">{config.metricSource !== 'alb' && <><button className={button} onClick={tick}>Advance one period</button><button className={button} onClick={() => setPlaying(!playing)}>{playing ? 'Pause scaling' : 'Play scaling'}</button></>}<button className={button} onClick={() => { setPlaying(false); const result = resetAsg(nodes, edges, group.id); setNodes(result.nodes); setEdges(result.edges); setError(''); }}>Reset scaling</button></div>
    <p>New instances appear in the blueprint’s subnet. Launching instances cannot serve requests. Warming instances can serve after assumed successful startup; warmup still blocks further scaling in this model. No scale-in, automatic failed-instance replacement, or ECS task scheduling in this bounded model.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div role="status" className="max-h-48 overflow-auto space-y-1">{runtime?.trace.map((line, i) => <p key={i}>{line}</p>)}</div>
  </section>;
}
