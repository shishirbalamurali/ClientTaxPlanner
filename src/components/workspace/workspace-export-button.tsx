'use client';

import { useState } from 'react';
import type { Client } from '@/lib/types';

/**
 * The sample clients have their workbooks built at deploy time. A loaded record
 * has no prebuilt file and must not be sent to a server, so the workbook is
 * generated here instead. ExcelJS is imported on click rather than at module
 * load, which keeps roughly half a megabyte out of the page for the people who
 * never press the button.
 */
export function WorkspaceExportButton({ client }: { client: Client }) {
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle');

  const download = async () => {
    setState('working');
    try {
      const { buildClientWorkbook } = await import('@/lib/excel/workbook');
      const buffer = await buildClientWorkbook(client);
      const blob = new Blob([buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const slug = client.displayName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
      anchor.href = url;
      anchor.download = `${slug || 'client'}-${client.taxYear}-Client-Analysis.xlsx`;
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
        <span className="text-[11px] text-flag">Could not build the workbook.</span>
      )}
      <button
        type="button"
        onClick={download}
        disabled={state === 'working'}
        className="rounded-[3px] border border-accent bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-accent-2 disabled:cursor-progress disabled:opacity-60"
      >
        {state === 'working' ? 'Building workbook…' : 'Export client analysis'}
      </button>
    </div>
  );
}
