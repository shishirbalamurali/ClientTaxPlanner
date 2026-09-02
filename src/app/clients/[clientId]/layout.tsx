import { notFound } from 'next/navigation';
import { ClientSwitcher } from '@/components/shell/client-switcher';
import { CompactNav } from '@/components/shell/compact-nav';
import { ExportButton } from '@/components/shell/export-button';
import { Sidebar } from '@/components/shell/sidebar';
import { sampleBasePath } from '@/components/shell/nav';
import { SAMPLE_CLIENTS, getClient } from '@/data/clients';
import { getTaxYear } from '@/lib/tax-year';

/**
 * The three sample clients are the only valid ids. Refusing on-demand rendering
 * makes every other path a static 404 served from the CDN, so the deployed site
 * has no request path that can invoke a server.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return SAMPLE_CLIENTS.map((client) => ({ clientId: client.id }));
}

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const client = getClient(clientId);
  if (!client) notFound();

  const constants = getTaxYear(client.taxYear);
  const options = SAMPLE_CLIENTS.map((entry) => ({
    id: entry.id,
    displayName: entry.displayName,
    archetypeLabel: entry.archetypeLabel,
    engagementRef: entry.engagementRef,
    stateCode: entry.residency.stateCode,
  }));

  return (
    <div className="flex min-h-screen">
      <Sidebar basePath={sampleBasePath(clientId)} />
      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-20 border-b border-rule bg-canvas/95 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5">
            <div className="flex items-center gap-3">
              <span className="font-serif text-[14px] leading-tight font-semibold text-ink lg:hidden">
                Private Client Tax Planning Simulator
              </span>
              <ClientSwitcher clients={options} currentId={clientId} />
              <span className="tnum hidden rounded-[2px] border border-rule-strong bg-canvas-2 px-2 py-1 text-[11px] text-ink-3 sm:inline-block">
                {constants.label}
              </span>
            </div>
            <ExportButton clientId={clientId} />
          </div>
          <CompactNav basePath={sampleBasePath(clientId)} />
          <div className="border-t border-rule bg-warn-wash px-5 py-1.5 text-[11px] text-warn">
            Educational model built on fictional client data. It does not provide tax, legal or
            financial advice and is not tax preparation software.
          </div>
        </header>
        <main className="px-5 py-6 xl:px-8">{children}</main>
      </div>
    </div>
  );
}
