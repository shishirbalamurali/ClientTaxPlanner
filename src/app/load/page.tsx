import type { Metadata } from 'next';
import { LoadClientForm } from '@/components/workspace/load-client-form';

export const metadata: Metadata = { title: 'Load a client record' };
export const dynamic = 'force-static';

export default function LoadPage() {
  return <LoadClientForm />;
}
