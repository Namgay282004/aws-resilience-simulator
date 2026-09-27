import test from 'node:test';
import assert from 'node:assert/strict';
import { createEc2S3Role } from '../src/engine/iam/ec2Role.ts';
import { authorizeApplicationHop } from '../src/engine/iam/applicationHop.ts';
test('EC2 scoped S3 role trusts EC2, allows reads, denies writes and other buckets', () => {
  const source: any = { id: 'ec2', data: { serviceId: 'ec2', label: 'EC2', iamRole: createEc2S3Role('Reader', 'arn:aws:s3:::bucket-a', false) } };
  const target: any = { id: 'bucket-a', data: { serviceId: 's3' } };
  assert.equal(authorizeApplicationHop(source, target, 'HTTPS').decision, 'ALLOW');
  assert.equal(authorizeApplicationHop(source, target, 'HTTPS', 's3:PutObject').decision, 'DENY');
  assert.equal(authorizeApplicationHop(source, { ...target, id: 'bucket-b' }, 'HTTPS').decision, 'DENY');
  source.data.iamRole = undefined;
  assert.equal(authorizeApplicationHop(source, target, 'HTTPS').decision, 'DENY');
  assert.throws(() => createEc2S3Role('Reader', 'arn:aws:s3:::*', false));
});
