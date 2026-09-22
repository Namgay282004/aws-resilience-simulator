/** Educational arithmetic only. Never used by request simulation or architecture state.
 * AWS policy concepts: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-auto-scaling.html
 * Adjustments: https://docs.aws.amazon.com/autoscaling/application/userguide/step-scaling-policy-overview.html
 */
export type DemoPolicy = 'target' | 'step' | 'scheduled';
export type DemoAdjustment = 'ChangeInCapacity' | 'PercentChangeInCapacity' | 'ExactCapacity';
export interface ScalingDemoInput {
  current: number; load: number; policy: DemoPolicy; adjustment: DemoAdjustment;
  amount: number; minimum: number; maximum: number; target: number; scheduled: number;
}
export function planDemoScaling(input: ScalingDemoInput) {
  const { current, load, policy, adjustment, amount, minimum, maximum, target, scheduled } = input;
  if (![current, load, amount, minimum, maximum, target, scheduled].every(Number.isFinite)
    || minimum < 1 || maximum > 12 || minimum > maximum || target <= 0
    || current < 1 || load < 0 || amount < 0 || scheduled < 1) throw new Error('Invalid demo settings');
  // Deliberately simple teaching assumptions: 100 load units/task at 100% utilization.
  const utilization = Math.min(100, Math.round(load / current));
  let requested = current;
  let reason = '';
  if (policy === 'target') {
    requested = Math.ceil(load / target);
    reason = `Illustrative target tracking: ceil(${load} load units / ${target}% target) = ${requested} tasks.`;
  } else if (policy === 'scheduled') {
    requested = scheduled;
    reason = `Scheduled action example: set the minimum to ${scheduled}; raise capacity if needed, independent of load.`;
    requested = Math.max(current, scheduled);
  } else if (utilization > target) {
    requested = adjustment === 'ExactCapacity' ? amount : current + (adjustment === 'PercentChangeInCapacity' ? (amount === 0 ? 0 : Math.max(1, Math.floor(current * amount / 100))) : amount);
    reason = `${utilization}% illustrative CPU exceeds ${target}%. Apply ${adjustment}: ${amount}.`;
  } else reason = `${utilization}% illustrative CPU does not exceed ${target}%. No step scale-out alarm.`;
  const desired = Math.max(minimum, Math.min(maximum, Math.ceil(requested)));
  return { desired, utilization, reason: `${reason} Bounded to ${minimum}–${maximum}: ${desired}.`, hosts: Math.ceil(desired / 2) };
}
export const DEMO_STAGES = ['Policy evaluated', 'Compute capacity ready', 'Images pulled; tasks starting', 'Targets registered; health checks passed', 'Traffic redistributed'] as const;
