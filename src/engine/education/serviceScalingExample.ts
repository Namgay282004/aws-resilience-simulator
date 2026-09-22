/** AWS adjustment arithmetic, isolated from the simplified presentation timeline.
 * https://docs.aws.amazon.com/autoscaling/application/userguide/step-scaling-policy-overview.html
 */
import type { DemoAdjustment } from './ecsScalingDemo.ts';
export function stepCapacity(current: number, adjustment: DemoAdjustment, amount: number): number {
  if (!Number.isInteger(current) || current < 0 || !Number.isInteger(amount) || (adjustment === 'ExactCapacity' && amount < 0)) throw new Error('Invalid capacity adjustment');
  if (adjustment === 'ExactCapacity') return amount;
  const delta = adjustment === 'ChangeInCapacity' ? amount : Math.sign(amount) * (amount === 0 ? 0 : Math.max(1, Math.floor(Math.abs(current * amount / 100))));
  return Math.max(0, current + delta);
}
export interface MetricScalingInput {
  metric: 'cpu' | 'backlog'; value: number; current: number; target: number;
  policy: 'target' | 'step' | 'scheduled'; adjustment: DemoAdjustment; amount: number;
  minimum: number; maximum: number; scheduledMinimum: number; metricsAvailable: boolean;
}
export function metricScalingExample(c: MetricScalingInput) {
  if (![c.value, c.current, c.target, c.amount, c.minimum, c.maximum, c.scheduledMinimum].every(Number.isFinite)
    || c.current < 1 || c.value < 0 || c.target <= 0 || c.minimum < 1 || c.maximum < c.minimum) throw new Error('Invalid example settings');
  if (c.policy !== 'scheduled' && !c.metricsAvailable) return { desired: c.current, metric: null, reason: 'Insufficient metric data: no scaling decision. Restore the required metrics first.' };
  const metric = c.metric === 'backlog' ? c.value / c.current : c.value;
  let desired = c.current;
  let reason: string;
  if (c.policy === 'scheduled') {
    desired = Math.max(c.current, c.scheduledMinimum);
    reason = `Scheduled minimum ${c.scheduledMinimum}; independent of metric demand. This example raises the lower bound, not a RunTask schedule.`;
  } else if (c.policy === 'target') {
    desired = Math.ceil(c.current * metric / c.target);
    reason = `Illustrative proportional estimate: ceil(${c.current} × ${metric.toFixed(1)} / ${c.target}) = ${desired}. AWS computes the actual adjustment and applies safeguards.`;
  } else if (metric > c.target) {
    desired = stepCapacity(c.current, c.adjustment, c.amount);
    reason = `Assume the high alarm has met its evaluation periods: ${metric.toFixed(1)} > ${c.target}. ${c.adjustment}(${c.amount}) → ${desired}.`;
  } else reason = `High alarm condition not met: ${metric.toFixed(1)} ≤ ${c.target}. No step adjustment.`;
  desired = Math.max(c.minimum, Math.min(c.maximum, desired));
  return { desired, metric, reason: `${reason} Capacity bounds ${c.minimum}–${c.maximum}: ${desired}.` };
}
