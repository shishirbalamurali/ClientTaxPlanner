import { notFound } from 'next/navigation';
import { WorkspaceView } from '@/components/workspace/workspace-view';
import { WORKSPACE_VIEWS, type WorkspaceViewSlug } from '@/components/workspace/views';

export const dynamicParams = false;
export const dynamic = 'force-static';

export function generateStaticParams() {
  return WORKSPACE_VIEWS.map((view) => ({ view }));
}

export default async function Page({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (!WORKSPACE_VIEWS.includes(view as WorkspaceViewSlug)) notFound();

  return <WorkspaceView slug={view as WorkspaceViewSlug} />;
}
