import { notFound } from 'next/navigation';
import { ResearchView } from '@/components/views/research-view';
import { getClient } from '@/data/clients';

export const dynamic = 'force-static';

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const client = getClient(clientId);
  if (!client) notFound();

  return <ResearchView client={client} />;
}
