import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  summary: string;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, summary, meta, actions }: PageHeaderProps) {
  return (
    <div className="mb-5 border-b border-rule pb-4">
      <div className="flex items-start justify-between gap-6">
        <div className="max-w-3xl">
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="mt-1 font-serif text-[24px] leading-tight font-semibold text-ink">
            {title}
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-3">{summary}</p>
        </div>
        {actions && <div className="shrink-0 pt-1">{actions}</div>}
      </div>
      {meta && <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">{meta}</div>}
    </div>
  );
}

export function MetaItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="eyebrow">{label}</span>
      <span className="tnum text-[12px] text-ink-2">{value}</span>
    </div>
  );
}
