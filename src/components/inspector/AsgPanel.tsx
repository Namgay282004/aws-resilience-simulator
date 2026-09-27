import React, { useEffect, useRef, useState } from 'react';
import { useArchitecture } from '../../context/ArchitectureContext.tsx';
import { advanceAsg, resetAsg, defaultAsgConfig, type AsgConfig, type AsgRuntime } from '../../engine/scaling/asg.ts';

export function AsgPanel() {
  const { selectedNode, nodes, effectiveNodes, edges, setNodes, setEdges, updateNodeData, runScenario } = useArchitecture();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState('');
  const group = selectedNode?.data.serviceId === 'ec2_auto_scaling' ? selectedNode : nodes.find(n => n.data.serviceId === 'ec2_auto_scaling' && n.data.customConfig?.asg?.alarmId === selectedNode?.id);
  const config: AsgConfig = { ...defaultAsgConfig, ...group?.data.customConfig?.asg };
  const runtime = group?.data.customConfig?.asgRuntime as AsgRuntime | undefined;
  const alarm = nodes.find(n => n.id === config.alarmId);
  const tick = () => {
    if (!group) return;
    if (config.metricSource === 'alb' && config.policyType !== 'scheduled') { runScenario(); return; }
    try {
      const value = alarm?.data.customConfig?.metricValue;
      const result = advanceAsg(effectiveNodes, edges, group.id, value === '' || value === undefined ? undefined : Number(value));
      // Failure overrides are inputs only, never persisted as base health.
      setNodes(result.nodes.map(n => { const original = nodes.find(o => o.id === n.id); return original ? { ...n, data: { ...n.data, health: original.data.health } } : n; }));
      setEdges(result.edges); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setPlaying(false); }
  };
  const tickRef = useRef(tick);
  tickRef.current = tick;
  useEffect(() => { if (!playing) return; const timer = window.setInterval(() => tickRef.current(), 1500 / speed); return () => window.clearInterval(timer); }, [playing, speed]);
  useEffect(() => { if (!runtime) setPlaying(false); }, [runtime]);
  if (!group) return <p className="text-xs text-slate-600">To drive EC2 scaling, select an ASG and choose this CloudWatch node as its dedicated scaling alarm.</p>;
  const update = (patch: Partial<AsgConfig>) => {
    const next = { ...config, ...patch };
    setPlaying(false); setError('');
    // Changing the policy starts a fresh run so old alarm samples/capacity cannot leak into it.
    const clean = resetAsg(nodes, edges, group.id);
    setNodes(clean.nodes.map(node => node.id === group.id ? { ...node, data: { ...node.data, customConfig: { ...node.data.customConfig, asg: next } } } : node));
    setEdges(clean.edges);
    if (next.metricSource === 'alb' && next.loadBalancerId && next.alarmId) setEdges(previous => {
      const retained = previous.filter(e => !e.data?.asgMonitoringFor || e.data.asgMonitoringFor !== group.id);
      if (retained.some(e => e.source === next.loadBalancerId && e.target === next.alarmId && e.data?.relationship === 'manages')) return retained;
      return [...retained, { id: `asg-monitor-${group.id}`, type: 'custom', source: next.loadBalancerId!, target: next.alarmId, data: { protocol: 'Event', interactionType: 'event', isCriticalDependency: false, timeoutMs: 3000, relationship: 'manages', label: 'ALB request metrics', asgMonitoringFor: group.id } }];
    });
  };
  const select = (label: string, key: 'templateId' | 'alarmId' | 'loadBalancerId', ids: string[]) => <label className="block">{label}<select className="block w-full border p-2 rounded" value={config[key] ?? ''} onChange={e => update({ [key]: e.target.value })}><option value="">Select…</option>{nodes.filter(n => ids.includes(n.data.serviceId)).map(n => <option key={n.id} value={n.id}>{n.data.label}</option>)}</select></label>;
  const button = 'border rounded px-3 py-2 min-h-11 hover:bg-slate-100';
  return <section className="p-3 border rounded space-y-3 text-xs" aria-label="ASG scaling simulation">
    <h3 className="font-bold">{group.data.label} · EC2 scaling</h3>
    <p>{config.metricSource === 'alb' ? 'Canvas-driven scaling: Send Request through the linked ALB to evaluate a synthetic one-minute traffic batch. No scaling playback or overlay is needed.' : 'Manual metric experiment.'}</p>
    {config.metricSource !== 'alb' && <p>Each tick samples the configured metric once and advances {config.period}s. Play accelerates simulated time; it does not collect real CPU metrics. Missing samples produce INSUFFICIENT_DATA.</p>}
    {config.metricSource === 'alb' && <p>One Send Request = one synthetic minute: Low 30, Normal 120, High 240, Very high 600, 10× 1,200, 100× 12,000 requests. Metric = requests / healthy ASG targets. Target tracking uses an illustrative proportional calculation, not AWS’s internal controller.</p>}
    <fieldset className="space-y-2">
      <label className="block">Metric source<select aria-label="Scaling metric source" className="block border rounded p-2 w-full" value={config.metricSource ?? 'manual'} onChange={e => update({ metricSource: e.target.value as 'manual' | 'alb', period: 60, policyType: 'simple' })}><option value="alb">Connected ALB request traffic</option><option value="manual">Manual metric sample</option></select></label>
      <label className="block">Policy type<select aria-label="Scaling policy type" className="block border rounded p-2 w-full" value={config.policyType ?? 'simple'} onChange={e => update({ policyType: e.target.value as AsgConfig['policyType'], targetValue: config.targetValue ?? 50, stepBands: config.stepBands ?? [{ above: 0, adjustment: 1 }, { above: 50, adjustment: 2 }], scheduledActions: config.scheduledActions ?? [{ at: 120, desired: config.max }, { at: 300, desired: Math.max(config.min, config.memberIds.length) }] })}><option value="simple">Simple scaling · fixed increment</option>{config.metricSource === 'alb' && <option value="target">Target tracking · illustrative</option>}<option value="step">Step scaling · breach bands</option><option value="scheduled">Scheduled scaling · simulated clock</option></select></label>
      {config.policyType === 'target' && <label className="block"><input type="checkbox" checked={!!config.scaleInEnabled} onChange={e => update({ scaleInEnabled: e.target.checked })} /> Enable scale-in to initial member count / minimum</label>}
      {config.policyType === 'step' && <div className="space-y-2"><p>Breach offsets above alarm threshold. Each band ends at the next offset; final band is unbounded.</p>{(config.stepBands ?? []).map((band, i) => <div key={i} className="flex gap-2"><label>Offset ≥<input aria-label={`Step ${i + 1} offset`} className="w-full border p-1" type="number" min={0} value={band.above} onChange={e => update({ stepBands: config.stepBands!.map((b, j) => j === i ? { ...b, above: Number(e.target.value) } : b) })} /></label><label>Add instances<input aria-label={`Step ${i + 1} adjustment`} className="w-full border p-1" type="number" min={0} value={band.adjustment} onChange={e => update({ stepBands: config.stepBands!.map((b, j) => j === i ? { ...b, adjustment: Number(e.target.value) } : b) })} /></label></div>)}</div>}
      {config.policyType === 'scheduled' && <div className="space-y-2"><p>One-time actions at simulated seconds, independent of traffic or alarm thresholds. Advance time below.</p>{(config.scheduledActions ?? []).map((action, i) => <div key={i} className="flex gap-2"><label>At second<input aria-label={`Schedule ${i + 1} time`} className="w-full border p-1" type="number" min={1} value={action.at} onChange={e => update({ scheduledActions: config.scheduledActions!.map((a, j) => j === i ? { ...a, at: Number(e.target.value) } : a) })} /></label><label>Desired instances<input aria-label={`Schedule ${i + 1} capacity`} className="w-full border p-1" type="number" min={Math.max(config.min, config.memberIds.length)} max={config.max} value={action.desired} onChange={e => update({ scheduledActions: config.scheduledActions!.map((a, j) => j === i ? { ...a, desired: Number(e.target.value) } : a) })} /></label></div>)}</div>}
      {config.policyType === 'target' && <label className="block">Target requests per healthy instance / minute<input className="block border p-2 w-full" type="number" min={1} value={config.targetValue ?? 50} onChange={e => update({ targetValue: Number(e.target.value) })} /></label>}
      {config.metricSource === 'alb' && select('Monitored ALB', 'loadBalancerId', ['alb'])}
      {selectedNode?.data.serviceId === 'cloudwatch' && <><label className="block">Instances added per simple scaling action<input type="number" min={1} value={config.adjustment} onChange={e => update({ adjustment: Number(e.target.value) })} /></label><label className="block">Consecutive breaching periods<input type="number" min={1} max={10} value={config.evaluationPeriods} onChange={e => update({ evaluationPeriods: Number(e.target.value) })} /></label></>}
    </fieldset>
    {selectedNode?.id === group.id && <fieldset className="space-y-2">
      {select('EC2 launch blueprint (inherits subnet, security groups and role)', 'templateId', ['ec2'])}
      {select('Dedicated CloudWatch alarm', 'alarmId', ['cloudwatch'])}
      {select('Load balancer (optional)', 'loadBalancerId', ['alb', 'nlb'])}
      <p>Initial EC2 members (one instance per node):</p>
      {nodes.filter(n => n.data.serviceId === 'ec2' && !n.data.customConfig?.asgInstance?.generated).map(n => <label className="block" key={n.id}><input type="checkbox" checked={config.memberIds.includes(n.id)} onChange={e => update({ memberIds: e.target.checked ? [...config.memberIds, n.id] : config.memberIds.filter(id => id !== n.id) })} /> {n.data.label}</label>)}
      {([['min', 'Minimum'], ['max', 'Maximum (≤20)'], ['adjustment', 'Instances added per alarm action'], ['evaluationPeriods', 'Consecutive breaching periods (1–10)'], ['period', 'Period seconds'], ['launchSeconds', 'Simulated launch seconds'], ['warmupSeconds', 'Warmup seconds'], ['cooldownSeconds', 'Simple policy cooldown seconds']] as const).map(([key, label]) => <label className="block" key={key}>{label}<input className="block border p-2 rounded w-full" type="number" min={0} value={config[key]} onChange={e => update({ [key]: Number(e.target.value) })} /></label>)}
    </fieldset>}
    <p>Policy edits pause playback and restart scaling, removing generated instances. Existing component positions are kept. Alarm threshold and sample edits apply to the next period.</p>
    {alarm && !['target', 'scheduled'].includes(config.policyType ?? '') && <label className="block">Alarm threshold ≥<input className="border p-2 w-full" type="number" value={alarm.data.customConfig?.threshold ?? 80} onChange={e => updateNodeData(alarm.id, { customConfig: { ...alarm.data.customConfig, threshold: Number(e.target.value) } })} /></label>}
    {alarm && config.metricSource !== 'alb' && <label className="block">CloudWatch metric sample (blank = missing)<input className="border p-2 w-full" type="number" value={alarm.data.customConfig?.metricValue ?? ''} onChange={e => updateNodeData(alarm.id, { customConfig: { ...alarm.data.customConfig, metricValue: e.target.value === '' ? '' : Number(e.target.value) } })} /></label>}
    {alarm?.data.customConfig?.asgObservation && <p>Last canvas observation: {alarm.data.customConfig.asgObservation.requests} synthetic requests / {alarm.data.customConfig.asgObservation.targets} healthy targets = {alarm.data.customConfig.asgObservation.value === null ? 'missing' : Number(alarm.data.customConfig.asgObservation.value).toFixed(1)} requests/target/minute.</p>}
    <p>Alarm: {alarm?.data.customConfig?.asgAlarm?.state ?? 'INSUFFICIENT_DATA'} · Clock: {runtime?.now ?? 0}s · Desired: {runtime?.desired ?? Math.max(config.min, config.memberIds.length)}</p>
    <div className="flex flex-wrap gap-2"><><button className={button} onClick={tick}>Advance one period</button><button className={button} onClick={() => setPlaying(!playing)}>{playing ? 'Pause scaling' : 'Play scaling'}</button><button className={button} onClick={() => { setSpeed(value => value === 1 ? 2 : value === 2 ? 5 : 1); setPlaying(true); }}>Faster time · {speed}×</button></><button className={button} onClick={() => { setPlaying(false); const result = resetAsg(nodes, edges, group.id); setNodes(result.nodes); setEdges(result.edges); setError(''); }}>Reset scaling</button></div>
    <p>Playback advances one simulated period every {(1.5 / speed).toFixed(1)} real seconds. ALB playback sends repeated requests using the selected scenario and traffic level.</p>
    <p>New instances appear in the blueprint’s subnet. Launching instances cannot serve requests. Warming instances can serve after assumed successful startup; warmup still blocks further scaling in this model. Target tracking can remove generated instances; scheduled actions can add or remove them. Initial instances are retained as the demo baseline. Step scaling models scale-out bands only. No connection draining, recurring calendar schedules, automatic failed-instance replacement, or ECS task scheduling.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div role="status" className="max-h-48 overflow-auto space-y-1">{runtime?.trace.map((line, i) => <p key={i}>{line}</p>)}</div>
  </section>;
}
