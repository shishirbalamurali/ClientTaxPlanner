import { CompactNav } from '@/components/shell/compact-nav';
import { WORKSPACE_BASE_PATH } from '@/components/shell/nav';
import { Sidebar } from '@/components/shell/sidebar';
import { WorkspaceHeader } from '@/components/workspace/workspace-header';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar basePath={WORKSPACE_BASE_PATH} />
      <div className="min-w-0 flex-1">
        <WorkspaceHeader />
        <CompactNav basePath={WORKSPACE_BASE_PATH} />
        <main className="px-5 py-6 xl:px-8">{children}</main>
      </div>
    </div>
  );
}
