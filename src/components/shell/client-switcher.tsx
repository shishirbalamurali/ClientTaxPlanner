'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';

export interface ClientOption {
  id: string;
  displayName: string;
  archetypeLabel: string;
  engagementRef: string;
  stateCode: string;
}

export function ClientSwitcher({
  clients,
  currentId,
}: {
  clients: ClientOption[];
  currentId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = clients.find((client) => client.id === currentId) ?? clients[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const select = (id: string) => {
    setOpen(false);
    if (id === currentId) return;
    const slug = pathname.split('/')[3] ?? 'dashboard';
    router.push(`/clients/${id}/${slug}`);
  };

  if (!current) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-2.5 rounded-[3px] border border-rule-strong bg-canvas px-2.5 py-1.5 text-left hover:border-ink-4"
      >
        <span>
          <span className="block text-[12.5px] leading-tight font-semibold text-ink">
            {current.displayName}
          </span>
          <span className="tnum block text-[10.5px] leading-tight text-ink-4">
            {current.archetypeLabel} · {current.engagementRef}
          </span>
        </span>
        <svg width="9" height="6" viewBox="0 0 9 6" aria-hidden className="text-ink-4">
          <path d="M1 1l3.5 3.5L8 1" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute top-full left-0 z-30 mt-1 w-[300px] border border-rule-strong bg-canvas shadow-[0_6px_20px_-8px_rgba(17,24,32,0.28)]"
        >
          {clients.map((client) => (
            <li key={client.id}>
              <button
                type="button"
                role="option"
                aria-selected={client.id === currentId}
                onClick={() => select(client.id)}
                className={cn(
                  'block w-full border-b border-rule px-3 py-2 text-left last:border-b-0 hover:bg-canvas-2',
                  client.id === currentId && 'bg-accent-wash',
                )}
              >
                <span className="block text-[12.5px] font-semibold text-ink">
                  {client.displayName}
                </span>
                <span className="tnum block text-[11px] text-ink-3">
                  {client.archetypeLabel} · {client.stateCode} · {client.engagementRef}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
