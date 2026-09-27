import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { DraftControls } from '../layout/DraftControls.tsx';

export function ExportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; dialog.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, [isOpen]);
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-[12000] bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="export-title" tabIndex={-1} className="bg-white text-slate-900 rounded-2xl border border-slate-200 shadow-2xl p-6 sm:p-8 w-full max-w-lg max-h-[90dvh] overflow-y-auto" onKeyDown={e => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab') {
        const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not([hidden]), select');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first.focus(); }
      }
    }}>
      <header className="flex justify-between items-center mb-3"><h2 id="export-title" className="text-2xl font-semibold tracking-tight">Export</h2><button aria-label="Close export" className="p-2 rounded hover:bg-slate-100" onClick={onClose}><X size={18} /></button></header>
      <p className="text-sm leading-relaxed text-slate-500 mb-6">Your architecture, ready to continue. Keep every component, connection and simulation setting in one JSON file.</p>
      <DraftControls />
    </div>
  </div>;
}
