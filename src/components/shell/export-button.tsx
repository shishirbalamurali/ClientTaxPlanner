'use client';

import { useState } from 'react';

export function ExportButton({ clientId }: { clientId: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle');

  const download = async () => {
    setState('working');
    try {
      const response = await fetch(`/api/export/${clientId}`);
      if (!response.ok) throw new Error(`Export failed with status ${response.status}`);

      const disposition = response.headers.get('content-disposition') ?? '';
      const match = /filename="?([^";]+)"?/.exec(disposition);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = match?.[1] ?? `${clientId}-analysis.xlsx`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setState('idle');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="flex items-center gap-2">
      {state === 'error' && (
        <span className="text-[11px] text-flag">Export failed. Try again.</span>
      )}
      <button
        type="button"
        onClick={download}
        disabled={state === 'working'}
        className="rounded-[3px] border border-accent bg-accent px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-accent-2 disabled:cursor-progress disabled:opacity-60"
      >
        {state === 'working' ? 'Building workbook…' : 'Export client analysis'}
      </button>
    </div>
  );
}
