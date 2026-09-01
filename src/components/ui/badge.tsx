import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { FindingSeverity } from '@/lib/rules';

const SEVERITY_STYLE: Record<FindingSeverity, string> = {
  review: 'border-flag/30 bg-flag-wash text-flag',
  monitor: 'border-warn/30 bg-warn-wash text-warn',
  informational: 'border-rule-strong bg-canvas-2 text-ink-3',
};

const SEVERITY_TEXT: Record<FindingSeverity, string> = {
  review: 'Review',
  monitor: 'Monitor',
  informational: 'Note',
};

export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return (
    <span
      className={cn(
        'inline-block shrink-0 rounded-[2px] border px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.06em]',
        SEVERITY_STYLE[severity],
      )}
    >
      {SEVERITY_TEXT[severity]}
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block rounded-[2px] border border-rule-strong bg-canvas-2 px-1.5 py-px text-[10.5px] text-ink-3',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function FormTag({ children }: { children: ReactNode }) {
  return (
    <span className="tnum inline-block rounded-[2px] border border-accent/20 bg-accent-wash px-1.5 py-px text-[10.5px] font-medium text-accent">
      {children}
    </span>
  );
}
