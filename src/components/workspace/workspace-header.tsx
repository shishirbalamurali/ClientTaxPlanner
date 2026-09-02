'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getTaxYear } from '@/lib/tax-year';
import { clearWorkspaceClient, useWorkspaceClient } from '@/lib/workspace-store';
import { WorkspaceExportButton } from './workspace-export-button';

export function WorkspaceHeader() {
  const client = useWorkspaceClient();
  const router = useRouter();

  return (
    <header className="no-print sticky top-0 z-20 border-b border-rule bg-canvas/95 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5">
        <div className="flex items-center gap-3">
          <span className="rounded-[3px] border border-rule-strong bg-canvas px-2.5 py-1.5">
            <span className="block text-[12.5px] leading-tight font-semibold text-ink">
              {client ? client.displayName : 'No record loaded'}
            </span>
            <span className="tnum block text-[10.5px] leading-tight text-ink-4">
              Your workspace · held in this tab only
            </span>
          </span>
          {client && (
            <span className="tnum hidden rounded-[2px] border border-rule-strong bg-canvas-2 px-2 py-1 text-[11px] text-ink-3 sm:inline-block">
              {getTaxYear(client.taxYear).label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/load"
            className="rounded-[3px] border border-rule-strong bg-canvas px-3 py-1.5 text-[12px] text-ink-2 hover:border-ink-4 hover:text-ink"
          >
            {client ? 'Replace record' : 'Load a record'}
          </Link>
          {client && <WorkspaceExportButton client={client} />}
          {client && (
            <button
              type="button"
              onClick={() => {
                clearWorkspaceClient();
                router.push('/load');
              }}
              className="rounded-[3px] border border-rule-strong bg-canvas px-3 py-1.5 text-[12px] text-ink-2 hover:border-flag hover:text-flag"
            >
              Discard
            </button>
          )}
        </div>
      </div>
      <div className="border-t border-rule bg-warn-wash px-5 py-1.5 text-[11px] text-warn">
        Educational model. Analysis runs in your browser and nothing is transmitted or stored on a
        server. Not tax, legal or financial advice.
      </div>
    </header>
  );
}
