import type { Node, Edge } from '@xyflow/react';
import { formatIp, parseCidr } from '../layout/cidrAllocator.ts';

/** Bounded simple scale-out policy. Explicit periods, fixed startup delay and cooldown.
 * https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-scaling-simple-step.html
 * Never infers group membership from nearby nodes, replica counts, or Multi-AZ flags.
 */
export interface AsgConfig {
  metricSource?: 'manual' | 'alb'; policyType?: 'simple' | 'target' | 'step' | 'scheduled'; targetValue?: number;
  scaleInEnabled?: boolean;
  stepBands?: { above: number; adjustment: number }[];
  scheduledActions?: { at: number; desired: number }[];
  templateId: string; memberIds: string[]; alarmId: string; loadBalancerId?: string;
  min: number; max: number; adjustment: number; period: number; evaluationPeriods: number;
  launchSeconds: number; warmupSeconds: number; cooldownSeconds: number;
}
export interface AsgRuntime {
  now: number; desired: number; sequence: number; cooldownUntil: number;
  samples: (number | null)[]; trace: string[];
}
export interface AsgInstance {
  groupId: string; state: 'Launching' | 'Warming' | 'InService'; generated: boolean;
  launchedAt: number; runningAt: number; readyAt: number;
}
export const defaultAsgConfig: AsgConfig = {
  templateId: '', memberIds: [], alarmId: '', loadBalancerId: '', min: 1, max: 4,
  adjustment: 1, period: 60, evaluationPeriods: 2, launchSeconds: 30,
  warmupSeconds: 30, cooldownSeconds: 120,
};
export function asgReady(data: any): boolean {
  return !data.customConfig?.asgInstance || ['Warming', 'InService'].includes(data.customConfig.asgInstance.state);
}
export function resetAsg(nodes: Node<any>[], edges: Edge<any>[], groupId?: string) {
  const matches = (id: string) => !groupId || id === groupId;
  const removed = new Set(nodes.filter(n => n.data.customConfig?.asgInstance?.generated && matches(n.data.customConfig.asgInstance.groupId)).map(n => n.id));
  return {
    nodes: nodes.filter(n => !removed.has(n.id)).map(n => {
      const config = n.data.customConfig;
      if (!config) return n;
      const next = { ...config };
      if (next.asgAlarm && matches(next.asgAlarm.groupId)) { delete next.asgAlarm; delete next.asgObservation; }
      if (next.asgInstance && matches(next.asgInstance.groupId)) delete next.asgInstance;
      if (n.data.serviceId === 'ec2_auto_scaling' && matches(n.id)) delete next.asgRuntime;
      return { ...n, data: { ...n.data, customConfig: next } };
    }),
    edges: edges.filter(e => !removed.has(e.source) && !removed.has(e.target) && !(e.data?.asgGroupId && matches(e.data.asgGroupId))),
  };
}
/** One period = one explicitly supplied sample. Transactional: errors never mutate inputs. */
export function advanceAsg(nodes: Node<any>[], edges: Edge<any>[], groupId: string, value?: number, observedTargetCount?: number) {
  const next = structuredClone(nodes); const links = structuredClone(edges);
  const group = next.find(n => n.id === groupId && n.data.serviceId === 'ec2_auto_scaling');
  if (!group || group.data.health === 'failed') throw new Error('ASG is missing or unavailable.');
  const config: AsgConfig = { ...defaultAsgConfig, ...group.data.customConfig?.asg };
  if (!['manual', 'alb'].includes(config.metricSource ?? 'manual') || !['simple', 'target', 'step', 'scheduled'].includes(config.policyType ?? 'simple')) throw new Error('Unsupported scaling policy or metric source.');
  if (config.policyType === 'target' && (config.metricSource !== 'alb' || !Number.isFinite(config.targetValue) || config.targetValue! <= 0)) throw new Error('Target tracking requires ALB metrics and a positive target.');
  if (config.metricSource === 'alb' && config.period !== 60) throw new Error('ALB request metrics use 60-second simulated periods.');
  const integers = [config.min, config.max, config.adjustment, config.period, config.evaluationPeriods, config.launchSeconds, config.warmupSeconds, config.cooldownSeconds];
  if (!integers.every(Number.isSafeInteger) || config.min < 0 || config.max < config.min || config.max > 20 || config.adjustment < 1 || config.period < 1 || config.evaluationPeriods < 1 || config.evaluationPeriods > 10 || Math.min(config.launchSeconds, config.warmupSeconds, config.cooldownSeconds) < 0) throw new Error('Invalid ASG bounds or timing (maximum 20 instances; 1–10 evaluation periods).');
  if (config.policyType === 'step') {
    const bands = config.stepBands ?? [];
    if (!bands.length || bands[0].above !== 0 || bands.some((b, i) => !Number.isFinite(b.above) || b.above < 0 || !Number.isSafeInteger(b.adjustment) || b.adjustment < 0 || (i > 0 && b.above <= bands[i - 1].above))) throw new Error('Step bands must start at zero with increasing breach offsets and nonnegative integer adjustments.');
  }
  if (config.policyType === 'scheduled' && (!config.scheduledActions?.length || config.scheduledActions.some((a, i, all) => !Number.isSafeInteger(a.at) || a.at < 1 || !Number.isSafeInteger(a.desired) || a.desired < Math.max(config.min, config.memberIds.length) || a.desired > config.max || all.some((b, j) => i !== j && a.at === b.at)))) throw new Error('Scheduled actions need unique positive seconds and desired capacity within bounds and at least the initial member count.');
  if (value !== undefined && !Number.isFinite(value)) throw new Error('Metric sample must be finite or missing.');
  const template = next.find(n => n.id === config.templateId && n.data.serviceId === 'ec2');
  const alarm = next.find(n => n.id === config.alarmId && n.data.serviceId === 'cloudwatch');
  if (!template || !alarm) throw new Error('Choose an EC2 launch blueprint and a CloudWatch alarm.');
  const threshold = config.policyType === 'target' ? config.targetValue! : Number(alarm.data.customConfig?.threshold ?? 80);
  if (!Number.isFinite(threshold)) throw new Error('Alarm threshold must be finite.');
  if (new Set(config.memberIds).size !== config.memberIds.length || config.memberIds.length > config.max) throw new Error('Invalid initial member list.');
  // Alarm history belongs to one group in this bounded implementation.
  if (next.some(n => n.id !== groupId && n.data.serviceId === 'ec2_auto_scaling' && n.data.customConfig?.asg?.alarmId === alarm.id)) throw new Error('This bounded model requires a dedicated alarm per ASG.');
  const lb = config.loadBalancerId ? next.find(n => n.id === config.loadBalancerId && ['alb', 'nlb'].includes(n.data.serviceId)) : undefined;
  if (config.loadBalancerId && !lb) throw new Error('Configured load balancer is missing.');
  group.data.customConfig ??= {};
  const runtime: AsgRuntime = group.data.customConfig.asgRuntime ??= { now: 0, desired: Math.max(config.min, config.memberIds.length), sequence: 0, cooldownUntil: 0, samples: [], trace: [] };
  if (![runtime.now, runtime.desired, runtime.sequence, runtime.cooldownUntil].every(Number.isSafeInteger) || runtime.now < 0 || runtime.sequence < 0 || runtime.desired < config.min || runtime.desired > config.max || !Array.isArray(runtime.samples) || !runtime.samples.every(v => v === null || Number.isFinite(v)) || !Array.isArray(runtime.trace)) throw new Error('Invalid saved ASG runtime. Reset scaling to start again.');
  const trace: string[] = [];
  for (const id of config.memberIds) {
    const member = next.find(n => n.id === id && n.data.serviceId === 'ec2');
    if (!member) throw new Error('An initial EC2 member is missing. Reset and reconfigure the group.');
    if (next.some(n => n.id !== groupId && n.data.serviceId === 'ec2_auto_scaling' && n.data.customConfig?.asg?.memberIds?.includes(id))) throw new Error('An EC2 instance cannot belong to two ASGs.');
    const owner = member.data.customConfig?.asgInstance?.groupId;
    if (owner && owner !== groupId) throw new Error('An EC2 instance cannot belong to two ASGs.');
    member.data.customConfig ??= {};
    member.data.customConfig.asgInstance ??= { groupId, generated: false, state: 'InService', launchedAt: 0, runningAt: 0, readyAt: 0 } satisfies AsgInstance;
  }
  runtime.now += config.period;
  const members = () => next.filter(n => n.data.customConfig?.asgInstance?.groupId === groupId);
  for (const member of members()) {
    const instance: AsgInstance = member.data.customConfig.asgInstance;
    const old = instance.state;
    instance.state = runtime.now >= instance.readyAt ? 'InService' : runtime.now >= instance.runningAt ? 'Warming' : 'Launching';
    if (old !== instance.state) trace.push(`${member.data.label}: ${old} → ${instance.state}.`);
  }
  const sample = alarm.data.health === 'failed' ? null : value ?? null;
  runtime.samples = [...runtime.samples, sample].slice(-config.evaluationPeriods);
  const enough = runtime.samples.length === config.evaluationPeriods;
  const alarmState = !enough || runtime.samples.includes(null) ? 'INSUFFICIENT_DATA' : runtime.samples.every(x => config.policyType === 'target' ? x! > threshold : x! >= threshold) ? 'ALARM' : 'OK';
  trace.push(`${runtime.now}s: ${alarm.data.label} ${alarmState}; ${runtime.samples.length}/${config.evaluationPeriods} samples, threshold ${config.policyType === 'target' ? '>' : '≥'} ${threshold}.`);
  alarm.data.customConfig ??= {};
  alarm.data.customConfig.asgAlarm = { groupId, state: alarmState, samples: [...runtime.samples], now: runtime.now };
  const ready = members().every(n => n.data.customConfig.asgInstance.state === 'InService');
  const inService = members().filter(n => n.data.customConfig.asgInstance.state === 'InService').length;
  let wanted = runtime.desired;
  if (config.policyType === 'scheduled') {
    const due = [...(config.scheduledActions ?? [])].filter(a => a.at > runtime.now - config.period && a.at <= runtime.now).sort((a, b) => a.at - b.at);
    for (const action of due) { wanted = action.desired; trace.push(`Scheduled action at ${action.at}s: desired ${wanted}; independent of CloudWatch alarm.`); }
  } else if (config.policyType === 'step' && alarmState === 'ALARM') {
    const band = [...config.stepBands!].reverse().find(b => (sample! - threshold) >= b.above)!;
    // Warming capacity counts toward desired, avoiding repeated additions for the same step.
    wanted = Math.max(runtime.desired, inService + band.adjustment);
    trace.push(`Step scaling: breach ${sample! - threshold}, adjustment +${band.adjustment}.`);
  } else if (config.policyType === 'target') {
    if (enough && !runtime.samples.includes(null)) {
      const demand = Math.ceil((sample ?? 0) * (observedTargetCount ?? members().filter(n => n.data.health === 'healthy' && asgReady(n.data)).length) / config.targetValue!);
      if (alarmState === 'ALARM') wanted = Math.max(runtime.desired, demand);
      else if (config.scaleInEnabled && ready && runtime.samples.every(x => x! < threshold) && runtime.now >= runtime.cooldownUntil) wanted = demand;
      trace.push(`Illustrative target tracking: estimated demand ${demand}.`);
    }
  } else if (alarmState === 'ALARM' && runtime.now >= runtime.cooldownUntil && ready) {
    wanted += config.adjustment;
    runtime.cooldownUntil = runtime.now + config.launchSeconds + config.cooldownSeconds;
  } else if (alarmState === 'ALARM') trace.push('Scaling deferred: launch/warmup or policy cooldown still active.');
  // Initial diagram instances are retained as the reproducible demo baseline.
  runtime.desired = Math.min(config.max, Math.max(config.min, config.memberIds.length, wanted));
  if (runtime.desired !== members().length) trace.push(`Policy desired ${runtime.desired} (bounds ${config.min}–${config.max}; initial instances retained).`);
  const remove = members().filter(n => n.data.customConfig.asgInstance.generated).reverse().slice(0, Math.max(0, members().length - runtime.desired));
  for (const node of remove) {
    next.splice(next.findIndex(n => n.id === node.id), 1);
    for (let i = links.length - 1; i >= 0; i--) if (links[i].source === node.id || links[i].target === node.id) links.splice(i, 1);
    trace.push(`${node.data.label}: terminated and deregistered from load balancer.`);
  }
  const needed = runtime.desired - members().length;
  if (needed > 0) {
    const subnetId = template.data.networkIdentity?.subnetId ?? template.parentId;
    const subnet = next.find(n => n.id === subnetId && ['public_subnet', 'private_subnet'].includes(n.data.boundaryType));
    const cidr = parseCidr(subnet?.data.cidr);
    if (!subnet || !cidr || cidr.prefix < 16 || cidr.prefix > 28) throw new Error('Launch blueprint needs an explicit subnet boundary with a valid IPv4 CIDR (/16–/28).');
    const size = 2 ** (32 - cidr.prefix); const base = Math.floor(cidr.base / size) * size;
    for (let i = 0; i < needed; i++) {
      const used = new Set(next.map(n => n.data.networkIdentity?.privateIp));
      let ip: string | undefined;
      for (let offset = 4; offset < Math.min(size - 1, 65536); offset++) { const candidate = formatIp(base + offset); if (!used.has(candidate)) { ip = candidate; break; } }
      if (!ip) throw new Error('No available simulated IPv4 address in the selected subnet.');
      let id: string; do { id = `${groupId}-instance-${++runtime.sequence}`; } while (next.some(n => n.id === id));
      let index = 0;
      while (next.some(n => n.parentId === subnet.id && n.type !== 'boundaryNode' && Math.abs(n.position.x - (30 + (index % 4) * 180)) < 140 && Math.abs(n.position.y - (190 + Math.floor(index / 4) * 130)) < 120)) index++;

      const instance: AsgInstance = { groupId, generated: true, state: 'Launching', launchedAt: runtime.now, runningAt: runtime.now + config.launchSeconds, readyAt: runtime.now + config.launchSeconds + config.warmupSeconds };
      const customConfig = structuredClone(template.data.customConfig ?? {});
      delete customConfig.serviceRuntime; delete customConfig.asg; delete customConfig.asgRuntime;
      customConfig.asgInstance = instance;
      next.push({ id, type: 'serviceNode', parentId: subnet.id, extent: 'parent', position: { x: 30 + (index % 4) * 180, y: 190 + Math.floor(index / 4) * 130 }, data: { ...structuredClone(template.data), label: `${group.data.label} · EC2 ${config.memberIds.length + runtime.sequence}`, health: 'healthy', replicas: 1, multiAz: false, isSimulating: false, customConfig, networkIdentity: { ...template.data.networkIdentity, subnetId: subnet.id, privateIp: ip } } });
      const height = Math.max(Number(subnet.data.height ?? 320), 340 + Math.floor(index / 4) * 130);
      const width = Math.max(Number(subnet.data.width ?? 800), 800);
      subnet.data.height = height; subnet.data.width = width; subnet.style = { ...subnet.style, height, width };
      // Grow enclosing VPC when required so generated hosts stay visually contained.
      const parent = next.find(n => n.id === subnet.parentId);
      if (parent) { const h = Math.max(Number(parent.data.height ?? 500), subnet.position.y + height + 30); const w = Math.max(Number(parent.data.width ?? 760), subnet.position.x + width + 30); parent.data.height = h; parent.data.width = w; parent.style = { ...parent.style, height: h, width: w }; }
      links.push({ id: `${groupId}-owns-${id}`, type: 'custom', source: groupId, target: id, data: { relationship: 'manages', protocol: 'Event', label: 'ASG member', asgGroupId: groupId } });
      trace.push(`${id}: launching in ${subnet.data.label}, IP ${ip}; ready after simulated startup/warmup.`);
    }
  }
  if (lb) for (const member of members()) {
    if (!links.some(e => e.source === lb.id && e.target === member.id)) links.push({ id: `${groupId}-target-${member.id}`, type: 'custom', source: lb.id, target: member.id, data: { protocol: lb.data.serviceId === 'nlb' ? 'TCP' : 'HTTP', label: 'ASG target', asgGroupId: groupId, relationship: 'request' } });
  }
  runtime.trace = [...runtime.trace, ...trace].slice(-100);
  return { nodes: next, edges: links, trace };
}
