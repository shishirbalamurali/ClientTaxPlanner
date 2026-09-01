import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  footnote?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Panel({
  title,
  description,
  actions,
  footnote,
  children,
  className,
  bodyClassName,
}: PanelProps) {
  return (
    <section className={cn('min-w-0 border border-rule bg-canvas', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-rule px-4 py-2.5">
          <div className="min-w-0">
            {title && <h2 className="text-[13px] font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[12px] text-ink-3">{description}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn(bodyClassName ?? 'p-4')}>{children}</div>
      {footnote && (
        <footer className="border-t border-rule bg-canvas-2 px-4 py-2 text-[11px] leading-relaxed text-ink-4">
          {footnote}
        </footer>
      )}
    </section>
  );
}
