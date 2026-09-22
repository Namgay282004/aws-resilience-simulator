import React from 'react';
import type { ServiceNodeData } from '../../types/index.ts';
import { endpointService, validateEndpoint } from '../../engine/network/vpcEndpoint.ts';

export function EndpointConfigurationPanel({ data, onChange }: {
  data: ServiceNodeData;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const value = endpointService(data) ?? '';
  const update = (endpointService: string) => onChange({ ...data.customConfig, endpointService });
  return <section className="space-y-2">
    <label className="block text-sm font-semibold">Endpoint destination service
      {data.serviceId === 's3_gateway_endpoint'
        ? <select className="block w-full border rounded p-2" value={value} onChange={e => update(e.target.value)}>
            <option value="s3">Amazon S3</option><option value="dynamodb">Amazon DynamoDB</option>
          </select>
        : <input className="block w-full border rounded p-2" value={value} placeholder="Service ID, e.g. sqs" onChange={e => update(e.target.value)} />}
    </label>
    <p className="text-xs text-slate-500">One endpoint targets one service. Regional availability, DNS, endpoint policies and route associations are not fully simulated.</p>
    {validateEndpoint(data).map(message => <p key={message} className="text-xs text-amber-700">{message}</p>)}
  </section>;
}
