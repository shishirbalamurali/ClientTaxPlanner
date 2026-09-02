import { notFound } from 'next/navigation';
import { IndividualTaxView } from '@/components/views/individual-tax-view';
import { getClient } from '@/data/clients';

export const dynamic = 'force-static';

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const client = getClient(clientId);
  if (!client) notFound();

  return <IndividualTaxView client={client} />;
}
