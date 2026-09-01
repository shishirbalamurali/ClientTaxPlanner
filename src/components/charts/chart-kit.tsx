'use client';

import type { ReactNode } from 'react';
import { compactUsd, usd } from '@/lib/format';

export const SERIES = [
  '#1b3b5f',
  '#3f6b96',
  '#7ea0bf',
  '#b6c8d8',
  '#5d7d6c',
  '#a08659',
  '#8a6a72',
  '#6b7280',
] as const;

export const AXIS_TICK = { fill: '#7d8894', fontSize: 10.5 } as const;
export const GRID_STROKE = '#eceff3';

export function seriesColor(index: number): string {
  return SERIES[index % SERIES.length]!;
}

interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatter = (value: number) => usd(value),
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  formatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-rule-strong bg-canvas px-2.5 py-2 text-[11.5px] shadow-[0_4px_14px_-6px_rgba(17,24,32,0.3)]">
      {label !== undefined && label !== '' && (
        <div className="mb-1 font-semibold text-ink">{label}</div>
      )}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 whitespace-nowrap">
          <span
            aria-hidden
            className="inline-block h-2 w-2 shrink-0"
            style={{ background: entry.color }}
          />
          <span className="text-ink-3">{entry.name}</span>
          <span className="tnum ml-auto pl-3 font-medium text-ink">
            {typeof entry.value === 'number' ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-baseline gap-2 text-[11.5px]">
          <span
            aria-hidden
            className="mt-1 inline-block h-2 w-2 shrink-0 self-start"
            style={{ background: item.color }}
          />
          <span className="text-ink-3">{item.label}</span>
          {item.value && (
            <span className="tnum ml-auto shrink-0 pl-2 text-ink-2">{item.value}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ChartFrame({ height, children }: { height: number; children: ReactNode }) {
  return (
    <div style={{ height }} className="w-full">
      {children}
    </div>
  );
}

export const compactAxis = (value: number) => compactUsd(value);
