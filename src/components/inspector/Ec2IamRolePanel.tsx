import React, { useState } from 'react';
import type { Node } from '@xyflow/react';
import type { ServiceNodeData } from '../../types/index.ts';
import { createEc2S3Role } from '../../engine/iam/ec2Role.ts';

export function Ec2IamRolePanel({ data, nodes, onChange }: {
  data: ServiceNodeData; nodes: Node<ServiceNodeData>[];
  onChange: (role: ServiceNodeData['iamRole']) => void;
}) {
  const [name, setName] = useState('EC2-S3-Access');
  const [bucketId, setBucketId] = useState('');
  const [write, setWrite] = useState(false);
  const [error, setError] = useState('');
  const buckets = nodes.filter(n => n.data.serviceId === 's3');
  return <section className="space-y-2 border rounded p-3 text-xs">
    <h3 className="font-semibold">EC2 IAM role</h3>
    <p>{data.iamRole ? `Attached: ${data.iamRole.id}` : 'No role attached'}</p>
    <p className="text-slate-500">Models an instance-profile role. Permissions do not create network connectivity. S3 is outside your subnet.</p>
    {data.iamRole ? <>
      <details><summary>View attached policies</summary><pre className="overflow-auto max-h-48 whitespace-pre-wrap">{JSON.stringify(data.iamRole, null, 2)}</pre></details>
      <button className="border rounded px-2 py-1" onClick={() => onChange(undefined)}>Detach role</button>
    </> : <>
      <label className="block">Role name<input className="block border rounded p-1 w-full" value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="block">S3 bucket<select className="block border rounded p-1 w-full" value={bucketId} onChange={e => setBucketId(e.target.value)}>
        <option value="">Select a bucket</option>{buckets.map(n => <option key={n.id} value={n.id}>{n.data.label}</option>)}
      </select></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={write} onChange={e => setWrite(e.target.checked)} />Also allow uploading objects (PutObject)</label>
      <p>Allows GetObject and ListBucket only for the selected bucket. Upload permission is optional.</p>
      <button className="border rounded px-2 py-1" disabled={!bucketId} onClick={() => {
        try {
          const bucket = buckets.find(n => n.id === bucketId);
          if (!bucket) throw new Error('Select an existing bucket.');
          const arn = String(bucket.data.customConfig?.resourceArn || `arn:aws:s3:::${bucket.id}`).split('/')[0];
          onChange(createEc2S3Role(name, arn, write)); setError('');
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not attach role.'); }
      }}>Attach S3 role</button>
      {!buckets.length && <p>Add an S3 bucket to the canvas first.</p>}
    </>}
    {error && <p role="alert" className="text-rose-700">{error}</p>}
  </section>;
}
