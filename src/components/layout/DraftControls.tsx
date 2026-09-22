import React, { useRef, useState } from 'react';
import { useArchitecture } from '../../context/ArchitectureContext.tsx';
import { DRAFT_KEY } from '../../engine/persistence/draft.ts';

export function DraftControls() {
  const { exportDraft, importDraft } = useArchitecture();
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const attempt = (action: () => void) => {
    try { action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Draft operation failed.'); }
  };
  const restore = (text: string) => {
    if (!window.confirm('Replace the current workspace with this draft? Save or export current work first if needed.')) return;
    importDraft(text); setMessage('Draft restored. Simulation playback is paused.');
  };
  return <details className="relative text-xs text-white">
    <summary className="cursor-pointer rounded border border-white/20 px-3 py-2">Drafts / Import JSON</summary>
    <div className="absolute right-0 top-full mt-2 w-72 rounded-lg bg-slate-900 border border-slate-600 p-3 shadow-xl space-y-2 z-50">
      <p>Save in this browser, or export JSON to keep a portable backup. Browser storage can be cleared; saving is manual.</p>
      <button className="block underline" onClick={() => attempt(() => {
        const text = exportDraft();
        if (localStorage.getItem(DRAFT_KEY) && !window.confirm('Replace the previously saved browser draft?')) return;
        localStorage.setItem(DRAFT_KEY, text); setMessage('Draft saved in this browser.');
      })}>Save draft</button>
      <button className="block underline" onClick={() => attempt(() => {
        const text = localStorage.getItem(DRAFT_KEY);
        if (!text) throw new Error('No draft saved in this browser yet.');
        restore(text);
      })}>Resume draft</button>
      <button className="block underline" onClick={() => attempt(() => {
        const url = URL.createObjectURL(new Blob([exportDraft()], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url;
        link.download = `architecture-draft-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage('JSON export downloaded.');
      })}>Export draft JSON</button>
      <button className="block underline" onClick={() => file.current?.click()}>Import draft JSON</button>
      <input ref={file} hidden type="file" accept=".json,application/json" aria-label="Import draft JSON file" onChange={async event => {
        const selected = event.target.files?.[0]; event.target.value = '';
        if (!selected) return;
        if (selected.size > 20_000_000) { setMessage('Draft exceeds the 20 MB import limit.'); return; }
        try { const text = await selected.text(); attempt(() => restore(text)); }
        catch { setMessage('Could not read the selected file.'); }
      }} />
      <p role="status" className="text-amber-200">{message}</p>
    </div>
  </details>;
}
