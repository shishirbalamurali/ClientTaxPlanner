'use client';

import Link from 'next/link';
import { DashboardView } from '@/components/views/dashboard-view';
import { ForeignAccountsView } from '@/components/views/foreign-accounts-view';
import { IndividualTaxView } from '@/components/views/individual-tax-view';
import { ProfileView } from '@/components/views/profile-view';
import { ResearchView } from '@/components/views/research-view';
import { ScenariosView } from '@/components/views/scenarios-view';
import { SummaryView } from '@/components/views/summary-view';
import { TrustsView } from '@/components/views/trusts-view';
import { WealthTransferView } from '@/components/views/wealth-transfer-view';
import { WORKSPACE_BASE_PATH } from '@/components/shell/nav';
import { useWorkspaceClient } from '@/lib/workspace-store';
import type { Client } from '@/lib/types';
import type { WorkspaceViewSlug } from './views';

function render(slug: WorkspaceViewSlug, client: Client) {
  switch (slug) {
    case 'dashboard':
      return <DashboardView client={client} basePath={WORKSPACE_BASE_PATH} />;
    case 'profile':
      return <ProfileView client={client} />;
    case 'individual-tax':
      return <IndividualTaxView client={client} />;
    case 'wealth-transfer':
      return <WealthTransferView client={client} />;
    case 'trusts':
      return <TrustsView client={client} />;
    case 'foreign-accounts':
      return <ForeignAccountsView client={client} />;
    case 'scenarios':
      return <ScenariosView client={client} />;
    case 'research':
      return <ResearchView client={client} />;
    case 'summary':
      return <SummaryView client={client} />;
  }
}

export function WorkspaceView({ slug }: { slug: WorkspaceViewSlug }) {
  const client = useWorkspaceClient();

  // Undefined during the server render and the first paint; null once the
  // browser has looked and found nothing loaded.
  if (client === undefined) return null;

  if (client === null) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center">
        <div className="eyebrow">Workspace</div>
        <h1 className="mt-2 font-serif text-[22px] font-semibold text-ink">
          No client record is loaded
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-3">
          The workspace analyses a record you paste in. Records live in this browser tab only, so
          one is not carried over from a previous visit.
        </p>
        <Link
          href="/load"
          className="mt-5 inline-block rounded-[3px] border border-accent bg-accent px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-accent-2"
        >
          Load a client record
        </Link>
      </div>
    );
  }

  return render(slug, client);
}
