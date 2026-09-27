import test from 'node:test';
import assert from 'node:assert/strict';
import { asgMembershipFrames } from '../src/engine/layout/asgMembershipFrames.ts';

test('ASG membership frames use absolute nested positions and resize without changing subnet ownership', () => {
  const nodes: any[] = [
    { id: 'vpc', position: { x: 300, y: 0 }, data: {} },
    { id: 'subnet', parentId: 'vpc', position: { x: 30, y: 60 }, data: {} },
    { id: 'group', position: { x: 0, y: 0 }, data: { serviceId: 'ec2_auto_scaling', label: 'Demo ASG', customConfig: { asg: { memberIds: ['ec2'] } } } },
    { id: 'ec2', parentId: 'subnet', position: { x: 30, y: 190 }, data: { serviceId: 'ec2' } },
  ];
  const original = structuredClone(nodes);
  const frame = asgMembershipFrames(nodes)[0];
  assert.deepEqual(frame.position, { x: 344, y: 214 });
  const generated = { id: 'new', parentId: 'subnet', position: { x: 390, y: 190 }, data: { serviceId: 'ec2', customConfig: { asgInstance: { groupId: 'group' } } } };
  const grown = asgMembershipFrames([...nodes, generated])[0];
  assert.ok(Number(grown.style!.width) > Number(frame.style!.width));
  assert.deepEqual(asgMembershipFrames(nodes)[0], frame);
  assert.deepEqual(nodes, original);
  assert.equal(asgMembershipFrames([...nodes, { ...generated, parentId: 'other-subnet' }]).length, 2);
  assert.equal(asgMembershipFrames(nodes.map(n => n.id === 'ec2' ? { ...n, hidden: true } : n)).length, 0);
});
