'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { NAV_GROUPS, WORKSPACE_BASE_PATH, navHref } from './nav';

export function Sidebar({ basePath }: { basePath: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="no-print sticky top-0 hidden h-screen w-[228px] shrink-0 flex-col border-r border-rule bg-canvas-2 lg:flex"
    >
      <div className="border-b border-rule px-4 py-3.5">
        <Link href={navHref(basePath, 'dashboard')} className="block">
          <div className="font-serif text-[15px] leading-tight font-semibold text-ink">
            Private Client
          </div>
          <div className="font-serif text-[15px] leading-tight text-ink-3">Tax Planning Simulator</div>
        </Link>
        <div className="mt-2 text-[10px] tracking-[0.06em] text-ink-4 uppercase">
          Educational model · synthetic data
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <div className="eyebrow px-4 pb-1.5">{group.label}</div>
            <ul>
              {group.items.map((item) => {
                const href = navHref(basePath, item.slug);
                const active = pathname === href;
                return (
                  <li key={item.slug}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'block border-l-2 py-1.5 pr-3 pl-[14px] text-[12.5px] transition-colors',
                        active
                          ? 'border-accent bg-canvas font-semibold text-ink'
                          : 'border-transparent text-ink-3 hover:bg-canvas hover:text-ink',
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {basePath !== WORKSPACE_BASE_PATH && (
        <div className="border-t border-rule px-4 py-3">
          <Link
            href="/load"
            className="block text-[12px] font-medium text-accent-2 hover:underline"
          >
            Load your own record →
          </Link>
          <p className="mt-1 text-[10.5px] leading-relaxed text-ink-4">
            Runs every module on a record you paste in. Stays in your browser.
          </p>
        </div>
      )}

      <div className="border-t border-rule px-4 py-3 text-[10.5px] leading-relaxed text-ink-4">
        No tax, legal or financial advice. All client data is fictional.
      </div>
    </nav>
  );
}
