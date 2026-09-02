import { notFound } from 'next/navigation';
import { sampleBasePath } from '@/components/shell/nav';
import { DashboardView } from '@/components/views/dashboard-view';
import { getClient } from '@/data/clients';

export const dynamic = 'force-static';

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const client = getClient(clientId);
  if (!client) notFound();

  return <DashboardView client={client} basePath={sampleBasePath(clientId)} />;
}
