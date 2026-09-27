import React, { useState } from 'react';
import { useArchitecture } from '../../context/ArchitectureContext.tsx';
import type { NaclRule, SubnetNaclConfig } from '../../types/index.ts';

export const NaclSideColumn: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { nodes, selectedNode, updateNodeData, runScenario } = useArchitecture();
  const subnets = nodes.filter(n => n.type === 'boundaryNode' && ['public_subnet', 'private_subnet'].includes(String(n.data.boundaryType)) && n.data.customNacl);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const subnet = subnets.find(n => n.id === chosenId) ?? subnets.find(n => n.id === selectedNode?.id) ?? subnets[0];
  const config = subnet?.data.customNacl as SubnetNaclConfig | undefined;
  const update = (direction: 'inboundRules' | 'outboundRules', index: number, patch: Partial<NaclRule>) => {
    if (!subnet || !config) return;
    updateNodeData(subnet.id, { customNacl: { ...config, [direction]: config[direction].map((rule, i) => i === index ? { ...rule, ...patch } : rule) } });
  };
  return <aside className="w-96 bg-white border-l border-slate-200 flex flex-col h-full shrink-0 overflow-y-auto p-4 space-y-4 text-xs">
    <div className="flex justify-between items-center"><h3 className="font-bold">Subnet NACL rules</h3><button onClick={onClose}>Close</button></div>
    {!config || !subnet ? <p>Select a subnet and enable its NACL rule set.</p> : <>
      <label>Subnet
        <select className="block w-full border rounded p-2 mt-1" value={subnet.id} onChange={e => setChosenId(e.target.value)}>
          {subnets.map(n => <option key={n.id} value={n.id}>{n.data.label}</option>)}
        </select>
      </label>
      <p className="font-semibold">{config.naclName}</p>
      <p>NACLs are stateless: request and response traffic need separate rules. Rules are evaluated by ascending number, with a final deny. Changes here apply only to this subnet.</p>
      {(['inboundRules', 'outboundRules'] as const).map(direction => <section key={direction} className="space-y-2">
        <h4 className="font-bold">{direction === 'inboundRules' ? 'Inbound rules — source CIDR' : 'Outbound rules — destination CIDR'}</h4>
        {config[direction].map((rule, index) => <div key={`${index}-${rule.ruleNumber}`} className="border rounded p-2 space-y-2">
          <div className="flex justify-between"><span>Rule {rule.ruleNumber === 32767 ? '*' : rule.ruleNumber} · {rule.type}</span><span>{rule.protocol}</span></div>
          <div className="flex gap-2">
            <label className="min-w-0 flex-1">CIDR<input aria-label={`${direction} rule ${rule.ruleNumber} CIDR`} className="w-full border rounded p-1" disabled={rule.ruleNumber === 32767} value={rule.cidr} onChange={e => update(direction, index, { cidr: e.target.value })} /></label>
            <label>Action<select aria-label={`${direction} rule ${rule.ruleNumber} action`} className="block border rounded p-1" disabled={rule.ruleNumber === 32767} value={rule.action} onChange={e => update(direction, index, { action: e.target.value as 'ALLOW' | 'DENY' })}><option>ALLOW</option><option>DENY</option></select></label>
          </div>
          <p>Ports: {rule.portRange}</p>
          {direction === 'inboundRules' && rule.portRange === '1024-65535' && <label className="flex items-center gap-2"><input type="checkbox" checked={!!rule.isMissingReturn} onChange={e => update(direction, index, { isMissingReturn: e.target.checked })} />Simulate missing return rule (diagram 3.1)</label>}
        </div>)}
      </section>)}
      <p className="text-slate-500">Current simulation coverage is partial: inbound rules and the database return-rule experiment are evaluated. Full outbound and packet-level CIDR enforcement are still on the roadmap.</p>
      <button className="bg-circuit-600 text-white rounded p-2" onClick={runScenario}>Simulate request and response</button>
    </>}
  </aside>;
};
