import React, { useState } from 'react';
import { ArrowDown, Server } from 'lucide-react';
const button = 'min-h-11 px-3 py-2 border rounded bg-white hover:bg-circuit-50 text-sm';
/** Fixed service identity: ALB cannot silently switch into NLB. Targets are labeled examples. */
export function LoadBalancerLesson({ kind }: { kind: 'alb' | 'nlb' }) {
  const [path, setPath] = useState('/api/orders');
  const [requests, setRequests] = useState({ api: 0, web: 0 });
  const [connection, setConnection] = useState(1);
  const [sent, setSent] = useState(0);
  const group = kind === 'alb' && !path.startsWith('/api/') ? 'web' : 'api';
  const target = sent ? kind === 'alb' ? (requests[group] - 1) % 2 : (connection - 1) % 2 : -1;
  return <section aria-label="Load balancer demonstration" className="space-y-4">
    <h3 className="text-lg font-semibold">{kind === 'alb' ? 'ALB · Layer 7 HTTP routing' : 'NLB · Layer 4 TCP flow routing'}</h3>
    <p className="text-sm text-slate-600">Example targets below are outside the load balancer. They are not discovered target groups or registered targets from this architecture.</p>
    <label className="block text-sm">Example HTTP path<select className="block border rounded p-2 mt-1 w-full" value={path} onChange={e => { setPath(e.target.value); setSent(0); }}><option>/api/orders</option><option>/</option></select></label>
    <div className="flex flex-wrap gap-2"><button className={button} onClick={() => { setSent(v => v + 1); setRequests(v => ({ ...v, [group]: v[group] + 1 })); }}>{kind === 'alb' ? 'Send HTTP request' : 'Send on same TCP flow'}</button>{kind === 'nlb' && <button className={button} onClick={() => { setConnection(v => v + 1); setSent(0); }}>Open new connection</button>}</div>
    <div className="text-center border rounded p-3 bg-white">Client · {kind === 'alb' ? `GET ${path}` : `TCP connection ${connection}`}</div>
    <ArrowDown key={`packet-${sent}-${path}`} aria-hidden="true" className={`mx-auto text-circuit-700 ${sent ? 'ecs-demo-packet' : ''}`} />
    <section aria-label="Load balancer boundary" className="border-2 border-circuit-600 rounded-lg bg-circuit-50 p-4 space-y-2"><strong>{kind === 'alb' ? 'ALB HTTP listener :80' : 'NLB TCP listener :80'}</strong><p className="text-sm">{kind === 'alb' ? 'Priority 1: /api/* → API group; default → web group' : 'Default action → API group; connection flow hash selects a target'}</p></section>
    <ArrowDown aria-hidden="true" className="mx-auto text-circuit-700" />
    <div className="grid sm:grid-cols-2 gap-3">{(kind === 'alb' ? ['api', 'web'] : ['api']).map(g => <section key={g} aria-label={`${g} example target group`} className="border border-slate-400 rounded-lg p-3 bg-white space-y-2"><h4 className="font-semibold">{g === 'api' ? 'API' : 'Web'} target group</h4>{[0, 1].map(i => <div key={i} className={`border rounded p-3 text-sm ${sent && group === g && target === i ? 'bg-circuit-100 border-circuit-600' : 'bg-slate-50'}`}><Server size={18} className="inline mr-2" /><strong>{g} target {i + 1}</strong><span className="block text-xs">Healthy (assumed){sent && group === g && target === i ? ' · Receiving traffic' : ''}</span></div>)}</section>)}</div>
    <p role="status" className="text-sm text-circuit-800">{kind === 'alb' ? 'Each request evaluates listener rules; round-robin counters are independent per target group.' : 'The path is ignored. Repeated traffic on this TCP connection stays on the same target. New-connection assignments are illustrative, not AWS hash calculations.'}</p>
    <p className="text-xs text-slate-500">Successful healthy-target example only. Cross-zone settings, failure/fail-open cases, stickiness, TLS, and draining are not simulated. Load balancing does not change task or instance count.</p>
  </section>;
}
