import React, { useEffect, useState } from 'react';
import type { ServiceNodeData } from '../../types/index.ts';

/** Edits reference inputs only. Course/AWS checks stay in the lab engine. */
export function LabConfigurationPanel({ config, onChange }: {
  config: NonNullable<ServiceNodeData['customConfig']>;
  onChange: (config: NonNullable<ServiceNodeData['customConfig']>) => void;
}) {
  const serialized = JSON.stringify(config, null, 2);
  const [draft, setDraft] = useState(serialized);
  const [error, setError] = useState('');
  useEffect(() => { setDraft(serialized); setError(''); }, [serialized]);
  return <section className="p-3 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2">
    <h4 className="text-xs font-bold">Lab configuration</h4>
    <p className="text-xs text-slate-600">Edit the supplied settings, apply them, then use Check Configuration. Passing checks does not deploy or execute the service.</p>
    <label className="block text-xs font-semibold">Reference settings (JSON)
      <textarea aria-label="Lab configuration JSON" className="mt-1 w-full min-h-48 rounded border border-slate-300 p-2 font-mono text-xs" value={draft}
        onChange={event => { setDraft(event.target.value); setError(''); }} />
    </label>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    <button className="rounded bg-blue-700 text-white px-3 py-2 text-xs" onClick={() => {
      try {
        const parsed: unknown = JSON.parse(draft);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Enter a JSON object.');
        onChange(parsed as NonNullable<ServiceNodeData['customConfig']>);
        setError('');
      } catch { setError('Enter a valid JSON object before applying settings.'); }
    }}>Apply lab settings</button>
  </section>;
}
