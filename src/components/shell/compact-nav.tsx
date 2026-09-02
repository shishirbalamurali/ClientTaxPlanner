'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { NAV_ITEMS, navHref } from './nav';

/**
 * Horizontal fallback for viewports too narrow for the rail. The layout is
 * desktop-first; this exists so the application is still navigable on a laptop
 * running a split window or on a tablet.
 */
export function CompactNav({ basePath }: { basePath: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="no-print overflow-x-auto border-t border-rule bg-canvas-2 lg:hidden"
    >
      <ul className="flex min-w-max">
        {NAV_ITEMS.map((item) => {
          const href = navHref(basePath, item.slug);
          const active = pathname === href;
          return (
            <li key={item.slug}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block border-b-2 px-3 py-2 text-[12px] whitespace-nowrap',
                  active
                    ? 'border-accent bg-canvas font-semibold text-ink'
                    : 'border-transparent text-ink-3 hover:text-ink',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
