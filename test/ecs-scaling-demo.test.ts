import test from 'node:test';
import assert from 'node:assert/strict';
import { planDemoScaling, type ScalingDemoInput } from '../src/engine/education/ecsScalingDemo.ts';
const base: ScalingDemoInput = { current: 2, load: 300, policy: 'target', adjustment: 'ChangeInCapacity', amount: 2, minimum: 1, maximum: 8, target: 50, scheduled: 6 };
test('Teaching model: load raises task demand, bounds it, and sizes illustrative hosts independently', () => {
  assert.equal(planDemoScaling(base).desired, 6);
  assert.equal(planDemoScaling(base).hosts, 3);
  assert.equal(planDemoScaling({ ...base, load: 600 }).desired, 8);
  assert.equal(planDemoScaling({ ...base, load: 0 }).desired, 1);
  assert.equal(planDemoScaling(base).utilization, 100);
  assert.deepEqual(planDemoScaling(base), planDemoScaling(base));
});
test('Teaching model: scheduled minimum is independent of load and does not force scale-in', () => {
  assert.equal(planDemoScaling({ ...base, policy: 'scheduled', load: 0 }).desired, 6);
  assert.equal(planDemoScaling({ ...base, policy: 'scheduled', current: 8 }).desired, 8);
});
// AWS adjustment rule: https://docs.aws.amazon.com/autoscaling/application/userguide/step-scaling-policy-overview.html
// Scenario: alarm exceeds threshold; fixed +2, percentage +50%, exact 6, all yield 6 from 4.
// Only arithmetic is modeled, not CloudWatch alarm timing or ECS scheduling.
test('Step adjustment expressions preserve fixed, percent, and exact meanings', () => {
  const step = { ...base, policy: 'step' as const, current: 4, load: 400 };
  assert.equal(planDemoScaling(step).desired, 6);
  assert.equal(planDemoScaling({ ...step, adjustment: 'PercentChangeInCapacity', amount: 50 }).desired, 6);
  assert.equal(planDemoScaling({ ...step, adjustment: 'ExactCapacity', amount: 6 }).desired, 6);
  assert.equal(planDemoScaling({ ...step, load: 100 }).desired, 4);
  assert.equal(planDemoScaling({ ...step, adjustment: 'PercentChangeInCapacity', amount: 0 }).desired, 4);
  assert.equal(planDemoScaling({ ...step, adjustment: 'PercentChangeInCapacity', amount: 10 }).desired, 5);
  assert.throws(() => planDemoScaling({ ...base, maximum: Number.NaN }));
});

// Test IDs: SCALING-ADJUSTMENT-002, SQS-BACKLOG-001, SCHEDULED-BOUND-001.
// Official sources: step-scaling-policy-overview.html (Application Auto Scaling),
// service-autoscaling-queue.html (ECS), scheduled-scaling-policy-overview.html (Application Auto Scaling).
// Scenarios below verify the documented arithmetic/ownership boundaries, not AWS timing.
const { stepCapacity, metricScalingExample } = await import('../src/engine/education/serviceScalingExample.ts');
test('Step adjustments support signed AWS rounding and distinguish absolute capacity', () => {
  assert.equal(stepCapacity(4, 'ChangeInCapacity', -2), 2);
  assert.equal(stepCapacity(11, 'PercentChangeInCapacity', -30), 8);
  assert.equal(stepCapacity(4, 'PercentChangeInCapacity', -10), 3);
  assert.equal(stepCapacity(4, 'PercentChangeInCapacity', 0), 4);
  assert.equal(stepCapacity(4, 'ExactCapacity', 0), 0);
  assert.throws(() => stepCapacity(4, 'ExactCapacity', -1));
});
test('Queue metrics normalize by running workers; missing data cannot trigger scaling', () => {
  const config = { metric: 'backlog' as const, value: 300, current: 2, target: 50, policy: 'target' as const, adjustment: 'ChangeInCapacity' as const, amount: 2, minimum: 1, maximum: 8, scheduledMinimum: 6, metricsAvailable: true };
  assert.equal(metricScalingExample(config).metric, 150);
  assert.equal(metricScalingExample(config).desired, 6);
  assert.equal(metricScalingExample({ ...config, metricsAvailable: false }).desired, 2);
  assert.equal(metricScalingExample({ ...config, policy: 'scheduled', value: 0, metricsAvailable: false }).desired, 6);
  assert.equal(metricScalingExample({ ...config, policy: 'scheduled', current: 8 }).desired, 8);
});
