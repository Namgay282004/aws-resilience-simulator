import React, { useState } from 'react';
import { useArchitecture } from '../../context/ArchitectureContext.tsx';
import { operate, type Operation, type Runtime } from '../../engine/services/operations.ts';
export function ManagedServicePanel() {
  const { selectedNode, nodes, effectiveNodes, edges, setNodes, updateNodeData } = useArchitecture();
  const [body, setBody] = useState('Hello from the simulator');
  const [receipt, setReceipt] = useState('');
  const [error, setError] = useState('');
  if (!selectedNode) return null;
  const node = selectedNode;
  const config = node.data.customConfig ?? {};
  const state = config.serviceRuntime as Runtime | undefined;
  const update = (patch: Record<string, unknown>) => updateNodeData(node.id, { customConfig: { ...config, ...patch } });
  const run = (operation: Operation) => {
    try {
      const result = operate(effectiveNodes, edges, node.id, operation, { body, receipt, seconds: 30,
        value: config.metricValue === '' ? undefined : config.metricValue,
        action: config.eventName, category: config.eventCategory });
      // Only persist runtime changes, not injected-failure overrides.
      setNodes(nodes.map(original => {
        const next = result.nodes.find(n => n.id === original.id)?.data.customConfig?.serviceRuntime;
        return next ? { ...original, data: { ...original.data, customConfig: { ...original.data.customConfig, serviceRuntime: next } } } : original;
      })); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Operation failed.'); }
  };
  const button = (op: Operation, label: string) => <button key={op} className="border rounded px-2 py-1" onClick={() => run(op)}>{label}</button>;
  return <section className="space-y-3 border rounded p-3 text-xs">
    <h3 className="font-bold">Behavior simulation</h3>
    <p>Deterministic service experiment. Inspector actions are administrative simulations, not IAM-authorized application calls.</p>
    {['sqs', 'sns'].includes(node.data.serviceId) && <label className="block">Message<input className="block border p-1 w-full" value={body} onChange={e => setBody(e.target.value)} /></label>}
    {node.data.serviceId === 'sqs' && <>
      <label className="block">Visibility timeout (seconds)<input type="number" min={0} max={43200} value={config.visibilityTimeoutSeconds ?? 30} onChange={e => update({ visibilityTimeoutSeconds: Number(e.target.value) })} /></label>
      <p>Allowed SNS topics (simplified queue policy):</p>
      {nodes.filter(n => n.data.serviceId === 'sns').map(topic => <label className="block" key={topic.id}><input type="checkbox" checked={(config.allowedTopicIds ?? []).includes(topic.id)} onChange={e => update({ allowedTopicIds: e.target.checked ? [...(config.allowedTopicIds ?? []), topic.id] : (config.allowedTopicIds ?? []).filter((id: string) => id !== topic.id) })} />{topic.data.label}</label>)}
      <div className="flex flex-wrap gap-2">{button('send', 'Send')}{button('receive', 'Receive')}{button('advance', 'Advance 30 seconds')}</div>
      <label className="block">Receipt handle<input className="border w-full p-1" value={receipt} onChange={e => setReceipt(e.target.value)} /></label>{button('delete', 'Delete received message')}
      <p>Clock: {state?.now ?? 0}s · Messages: {state?.messages.length ?? 0}</p>
      {state?.messages.map(m => <div key={m.id} className="break-all">{m.id}: {m.visibleAt <= state.now ? 'visible' : 'in flight'} · receives {m.receives}{m.receipt && <button className="underline block" onClick={() => setReceipt(m.receipt!)}>Use receipt {m.receipt}</button>}</div>)}
    </>}
    {node.data.serviceId === 'sns' && <><p>Connect this topic to SQS queues and allow this topic in each queue. Other subscription protocols are not implemented.</p>{button('publish', 'Publish to connected queues')}</>}
    {node.data.serviceId === 'cloudwatch' && nodes.some(n => n.data.serviceId === 'ec2_auto_scaling' && n.data.customConfig?.asg?.alarmId === node.id) && <p>This alarm is assigned to an ASG. Use the EC2 scaling controls below to evaluate its consecutive-period samples.</p>}
    {node.data.serviceId === 'cloudwatch' && !nodes.some(n => n.data.serviceId === 'ec2_auto_scaling' && n.data.customConfig?.asg?.alarmId === node.id) && <>
      <label className="block">Metric value (blank = missing)<input type="number" value={config.metricValue ?? ''} onChange={e => update({ metricValue: e.target.value === '' ? '' : Number(e.target.value) })} /></label>
      <label className="block">Threshold ≥<input type="number" value={config.threshold ?? 80} onChange={e => update({ threshold: Number(e.target.value) })} /></label>
      <label className="block">Missing data<select value={config.treatMissingData ?? 'missing'} onChange={e => update({ treatMissingData: e.target.value })}>{['missing', 'ignore', 'breaching', 'notBreaching'].map(v => <option key={v}>{v}</option>)}</select></label>
      <p>Single-period alarm: {state?.alarm ?? 'INSUFFICIENT_DATA'}. Connect to SNS for notifications on entry into ALARM.</p>{button('metric', 'Evaluate metric')}
    </>}
    {node.data.serviceId === 'cloudtrail' && <>
      <label className="block"><input type="checkbox" checked={config.loggingEnabled !== false} onChange={e => update({ loggingEnabled: e.target.checked })} />Logging enabled</label>
      <label className="block"><input type="checkbox" checked={!!config.includeDataEvents} onChange={e => update({ includeDataEvents: e.target.checked })} />Include data events</label>
      <label className="block">Event category<select value={config.eventCategory ?? 'management'} onChange={e => update({ eventCategory: e.target.value })}><option>management</option><option>data</option></select></label>
      {button('audit', 'Record example API event')}
      <p>Connected supported services emit audit events here. This does not collect application logs or packet traffic.</p>
    </>}
    <p className="text-slate-500">Partial model: no FIFO, DLQ/redrive, delivery retries, multi-period alarms, log ingestion, or CloudTrail S3 delivery.</p>
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    <div role="status">{state?.trace.map((line, i) => <p key={i}>{line}</p>)}</div>
    {!!state?.records.length && <details><summary>Recorded samples/events ({state.records.length})</summary><pre className="whitespace-pre-wrap break-all max-h-64 overflow-auto">{JSON.stringify(state.records, null, 2)}</pre></details>}
  </section>;
}
