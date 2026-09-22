import React, { useEffect, useState } from 'react';
import { ArrowDown, Box, Server } from 'lucide-react';
import { metricScalingExample } from '../../engine/education/serviceScalingExample.ts';
import type { DemoAdjustment } from '../../engine/education/ecsScalingDemo.ts';
const button = 'min-h-11 border rounded px-3 py-2 text-sm bg-white hover:bg-circuit-50 disabled:opacity-50';
const input = 'block w-full mt-1 border rounded p-2 bg-white';
export function ScalingPolicyLesson({ source }: { source: 'cloudwatch' | 'sqs' | 'ec2_auto_scaling' | 'auto_scaling_mgmt' }) {
  const queue = source === 'sqs', ec2 = source === 'ec2_auto_scaling';
  const [current, setCurrent] = useState(2);
  const [value, setValue] = useState(queue ? 100 : 50);
  const [policy, setPolicy] = useState<'target' | 'step' | 'scheduled'>('target');
  const [adjustment, setAdjustment] = useState<DemoAdjustment>('ChangeInCapacity');
  const [amount, setAmount] = useState(2);
  const [available, setAvailable] = useState(true);
  const [stage, setStage] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [plan, setPlan] = useState<ReturnType<typeof metricScalingExample> | null>(null);
  const busy = stage >= 0 && stage < 3;
  const units = ec2 ? 'instances' : 'tasks';
  const owner = ec2 ? 'EC2 Auto Scaling' : 'Application Auto Scaling';
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const update = () => { setReduced(media.matches); if (media.matches) setPlaying(false); };
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => { if (!busy || !playing) return; const timer = window.setTimeout(() => setStage(s => s + 1), 1000); return () => window.clearTimeout(timer); }, [busy, playing, stage]);
  useEffect(() => { if (stage === 3 && plan) { setCurrent(plan.desired); setPlaying(false); } }, [stage, plan]);
  const desired = plan?.desired ?? current;
  const shown = busy && stage >= 2 ? Math.max(current, desired) : current;
  const scaleIn = busy && desired < current;
  const start = () => { const next = metricScalingExample({ metric: queue ? 'backlog' : 'cpu', value, current, target: 50, policy, adjustment, amount, minimum: 1, maximum: 8, scheduledMinimum: 6, metricsAvailable: available }); setPlan(next); setStage(next.desired === current ? 3 : 0); setPlaying(next.desired !== current && !reduced); };
  return <section aria-label="Scaling policy demonstration" className="space-y-4">
    <h3 className="text-lg font-semibold">{queue ? 'Queue backlog → worker capacity' : ec2 ? 'Metrics → EC2 fleet capacity' : 'CloudWatch metrics → scaling policy'}</h3>
    <p className="text-sm">{queue ? 'SQS reports queue depth. CloudWatch metric math divides it by running worker tasks; Application Auto Scaling owns the policy.' : `CloudWatch provides metrics and alarms. ${owner} owns the policy and changes desired ${units}.`}</p>
    <fieldset disabled={busy} className="space-y-3"><legend className="font-semibold text-sm">Example metric snapshot</legend>
      <label className="block text-sm">{queue ? 'Visible messages' : 'Average CPU utilization (%)'}: {value}<input aria-label="Scaling metric value" type="range" min="0" max={queue ? 600 : 100} step={queue ? 25 : 5} value={value} onChange={e => setValue(Number(e.target.value))} className="block w-full mt-2 accent-circuit-600" /></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={available} onChange={e => setAvailable(e.target.checked)} />Required metrics available{queue ? ' (including RunningTaskCount)' : ''}</label>
      <div className="grid sm:grid-cols-2 gap-3"><label className="text-sm">Policy mechanism<select className={input} value={policy} onChange={e => setPolicy(e.target.value as typeof policy)}><option value="target">Target tracking</option><option value="step">Step scaling</option>{(ec2 || source === 'auto_scaling_mgmt') && <option value="scheduled">Scheduled minimum increase</option>}</select></label>
        {policy === 'step' && <><label className="text-sm">Step adjustment expression<select className={input} value={adjustment} onChange={e => { setAdjustment(e.target.value as DemoAdjustment); setAmount(e.target.value === 'PercentChangeInCapacity' ? 50 : 2); }}><option>ChangeInCapacity</option><option>PercentChangeInCapacity</option><option>ExactCapacity</option></select></label><label className="text-sm">Adjustment value<select className={input} value={amount} onChange={e => setAmount(Number(e.target.value))}>{(adjustment === 'PercentChangeInCapacity' ? [25, 50, 100] : [1, 2, 4, 6]).map(v => <option key={v}>{v}</option>)}</select></label></>}
      </div>
      <p className="text-xs text-slate-500">Bounds: 1–8 {units}. {policy === 'scheduled' ? 'Scheduled minimum: 6; maximum remains 8.' : queue ? 'Target / high-alarm threshold: 50 messages per running task.' : 'Target / high-alarm threshold: 50% CPU.'}</p>
    </fieldset>
    <div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={start}>{policy === 'scheduled' ? 'Trigger scheduled scaling action' : 'Animate scaling'}</button><button className={button} disabled={!busy || reduced} onClick={() => setPlaying(v => !v)}>{playing ? 'Pause' : 'Resume'}</button><button className={button} disabled={!busy} onClick={() => { setPlaying(false); setStage(s => s + 1); }}>Next stage</button><button className={button} onClick={() => { setPlaying(false); setStage(-1); setPlan(null); setCurrent(2); setValue(queue ? 100 : 50); }}>Reset demo</button></div>
    <div role="status" className="border-l-4 border-circuit-500 pl-3 text-sm"><strong>{stage < 0 ? 'Ready to evaluate the example' : `${stage + 1}/4 · ${['Metric / scheduled action evaluated', 'Policy decision', scaleIn ? 'Drain and stop excess capacity' : 'Start additional capacity', 'Capacity settled'][stage]}`}</strong><p className="mt-1">{plan?.reason || (queue ? `${value} visible messages / ${current} running tasks = ${(value / current).toFixed(1)} backlog per task.` : `${value}% CPU across ${current} ${units}.`)}</p>{reduced && <p>Reduced motion: use Next stage.</p>}</div>
    <div className="text-center border rounded bg-white p-3">{queue ? 'SQS visible messages → CloudWatch backlog per task' : policy === 'scheduled' ? 'Scheduled scaling action' : 'CloudWatch metric / alarm'}</div><ArrowDown className="mx-auto text-circuit-700" aria-hidden="true" />
    <div className="border-2 border-circuit-600 rounded p-3 bg-circuit-50 text-center"><strong>{owner}</strong><p className="text-sm">{policy === 'step' ? adjustment : policy === 'target' ? 'Target tracking policy' : 'Scheduled capacity bounds'}</p></div><ArrowDown className="mx-auto text-circuit-700" aria-hidden="true" />
    <section aria-label="Example scaled capacity" className="border border-slate-400 rounded p-3 space-y-3"><h4 className="font-semibold">{ec2 ? 'EC2 Auto Scaling group' : 'ECS worker service'} · {current} ready / {desired} desired</h4><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{Array.from({ length: shown }, (_, i) => <div key={i} className={`border rounded p-3 bg-white text-sm ${i >= current ? 'ecs-demo-arrive border-circuit-500' : ''}`}>{ec2 ? <Server size={20} /> : <Box size={20} />}<strong>{ec2 ? 'Instance' : 'Task'} {i + 1}</strong><p className="text-xs">{busy && i >= current ? 'Starting' : scaleIn && i >= desired && stage >= 2 ? 'Draining' : 'Ready (assumed)'}</p></div>)}</div></section>
    <p className="text-xs text-slate-500">Independent example; no resources or policies are created. Target-tracking arithmetic is a proportional illustration, not AWS’s exact algorithm. Real alarm evaluation, cooldowns, deployments, startup, availability, and quotas affect results. ECS task scaling does not automatically imply EC2 host scaling; that needs a configured capacity provider. Zero-worker bootstrapping is outside this example.</p>
  </section>;
}
