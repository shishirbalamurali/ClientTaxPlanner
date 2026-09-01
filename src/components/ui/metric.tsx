import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface MetricProps {
  label: string;
  value: string;
  note?: ReactNode;
  tone?: 'default' | 'flag' | 'warn' | 'ok';
  className?: string;
}

const TONE_CLASS = {
  default: 'text-ink',
  flag: 'text-flag',
  warn: 'text-warn',
  ok: 'text-ok',
} as const;

export function Metric({ label, value, note, tone = 'default', className }: MetricProps) {
  return (
    <div className={cn('px-4 py-3', className)}>
      <div className="eyebrow">{label}</div>
      <div className={cn('tnum mt-1 text-[21px] leading-none font-semibold', TONE_CLASS[tone])}>
        {value}
      </div>
      {note && <div className="mt-1.5 text-[11.5px] leading-snug text-ink-3">{note}</div>}
    </div>
  );
}

export function MetricRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-rule border border-rule bg-canvas md:grid-cols-4">
      {children}
    </div>
  );
}

interface StatLineProps {
  label: string;
  value: string;
  emphasis?: boolean;
  indent?: boolean;
  note?: string;
}

export function StatLine({ label, value, emphasis, indent, note }: StatLineProps) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 border-b border-rule py-1.5 last:border-b-0',
        emphasis && 'font-semibold text-ink',
      )}
    >
      <span className={cn('text-[12.5px]', indent && 'pl-4 text-ink-3')}>
        {label}
        {note && <span className="ml-1.5 text-[11px] text-ink-4">{note}</span>}
      </span>
      <span className="tnum shrink-0 text-[12.5px]">{value}</span>
    </div>
  );
}
