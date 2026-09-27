import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeachingNacl } from '../src/engine/network/naclPreset.ts';
import { checkCustomNaclReturn } from '../src/engine/simulation/networkFirewalls.ts';
import { evaluateNaclRules } from '../src/engine/network/nacl.ts';
test('Teaching NACLs have independent inbound/outbound rules with terminal deny', () => {
  const a = createTeachingNacl('Public A', true);
  const b = createTeachingNacl('Private B', false);
  assert.equal(evaluateNaclRules(a.inboundRules, 'HTTP').blocked, false);
  assert.equal(evaluateNaclRules(b.inboundRules, 'HTTP').blocked, true);
  assert.equal(evaluateNaclRules(b.inboundRules, 'SQL').blocked, false);
  assert.equal(a.outboundRules.at(-1)?.action, 'DENY');
  a.inboundRules[1].action = 'DENY';
  assert.equal(b.inboundRules[0].action, 'ALLOW');
});
test('Diagram 3.1 missing-return experiment works for any explicitly assigned subnet', () => {
  for (const boundaryType of ['public_subnet', 'private_subnet']) {
    const customNacl = createTeachingNacl('Student subnet', boundaryType === 'public_subnet');
    const subnet: any = { id: 'student-subnet', type: 'boundaryNode', position: { x: 0, y: 0 }, data: { boundaryType, customNacl } };
    const source: any = { id: 'app', position: { x: 900, y: 900 }, data: { label: 'App', networkIdentity: { subnetId: subnet.id } } };
    const target: any = { data: { label: 'DB' } };
    assert.equal(checkCustomNaclReturn(source, target, [subnet]).blocked, false);
    customNacl.inboundRules.find(rule => rule.isStatelessReturn)!.isMissingReturn = true;
    assert.equal(checkCustomNaclReturn(source, target, [subnet]).blocked, true);
  }
});
