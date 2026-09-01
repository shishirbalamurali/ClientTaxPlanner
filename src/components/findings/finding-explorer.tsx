'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { pct, usd } from '@/lib/format';
import { getAuthorities } from '@/lib/research/authorities';
import { MODULE_LABELS, type Finding, type FindingModule, type RuleMeta } from '@/lib/rules';
import { FormTag, SeverityBadge } from '@/components/ui/badge';
import { replaceHash, useHash } from './use-hash';

function measurementText(finding: Finding): string | null {
  const m = finding.measurement;
  if (!m) return null;
  const render = (value: number) =>
    m.unit === 'usd' ? usd(value) : m.unit === 'percent' ? pct(value) : String(value);
  const verb = {
    exceeds: 'against a threshold of',
    atOrAbove: 'against a threshold of',
    below: 'against a threshold of',
    equals: 'against',
  }[m.comparison];
  return `${m.label}: ${render(m.value)} ${verb} ${render(m.threshold)}.`;
}

function Step({
  index,
  label,
  children,
}: {
  index: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative pl-9">
      <span className="tnum absolute top-0 left-0 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-rule-strong bg-canvas text-[10px] font-semibold text-ink-3">
        {index}
      </span>
      <div className="eyebrow">{label}</div>
      <div className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

function FindingDetail({ finding, rule }: { finding: Finding; rule?: RuleMeta }) {
  const authorities = getAuthorities(finding.authorityIds);
  const measurement = measurementText(finding);

  return (
    <div className="border-t border-rule bg-canvas-2 px-4 py-4">
      <div className="eyebrow mb-3">Why was this flagged?</div>
      <div className="space-y-4 border-l border-dashed border-rule-strong pl-0">
        <Step index={1} label="Client fact">
          {finding.clientFact}
          {measurement && <div className="tnum mt-1 text-ink-3">{measurement}</div>}
        </Step>
        <Step index={2} label="Applicable rule">
          <span className="font-medium text-ink">{finding.ruleName}</span>
          {rule && (
            <>
              <div className="mt-0.5">{rule.description}</div>
              <div className="mt-1.5 inline-block border border-rule-strong bg-canvas px-2 py-1 font-mono text-[11px] text-ink-3">
                {rule.id} · {rule.test}
              </div>
            </>
          )}
        </Step>
        <Step index={3} label="Analysis">
          {finding.analysis}
        </Step>
        <Step index={4} label="Potential form">
          <div className="flex flex-wrap gap-1.5">
            {finding.potentialForms.map((form) => (
              <FormTag key={form}>{form}</FormTag>
            ))}
          </div>
        </Step>
        <Step index={5} label="Source">
          <ul className="space-y-1.5">
            {authorities.map((authority) => (
              <li key={authority.id}>
                <a
                  href={authority.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium text-accent-2 underline decoration-rule-strong underline-offset-2 hover:decoration-accent-2"
                >
                  {authority.citation}
                </a>
                <span className="text-ink-4"> — {authority.governmentSource}</span>
                <div className="text-ink-3">{authority.ruleDescription}</div>
              </li>
            ))}
          </ul>
        </Step>
      </div>

      {finding.questionsForReview.length > 0 && (
        <div className="mt-4 border-t border-rule pt-3">
          <div className="eyebrow">Questions requiring professional review</div>
          <ul className="mt-1.5 space-y-1">
            {finding.questionsForReview.map((question) => (
              <li key={question} className="flex gap-2 text-[12.5px] text-ink-2">
                <span aria-hidden className="text-ink-4">
                  —
                </span>
                <span>{question}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Findings are addressable, so a reviewer can send a colleague a link to one. */
function anchorFor(findingId: string): string {
  return `finding-${encodeURIComponent(findingId)}`;
}

export function FindingExplorer({
  findings,
  rules,
  showModule = true,
  emptyMessage = 'No review items were raised by the rule set for this module.',
}: {
  findings: Finding[];
  rules: Record<string, RuleMeta>;
  showModule?: boolean;
  emptyMessage?: string;
}) {
  const [moduleFilter, setModuleFilter] = useState<FindingModule | 'all'>('all');
  const hash = useHash();
  const openId = hash.startsWith('finding-')
    ? decodeURIComponent(hash.slice('finding-'.length))
    : null;

  const toggle = (finding: Finding) => {
    replaceHash(openId === finding.id ? '' : anchorFor(finding.id));
  };

  const modules = useMemo(
    () => [...new Set(findings.map((finding) => finding.module))],
    [findings],
  );
  const visible = useMemo(
    () =>
      moduleFilter === 'all'
        ? findings
        : findings.filter((finding) => finding.module === moduleFilter),
    [findings, moduleFilter],
  );

  if (findings.length === 0) {
    return <p className="px-4 py-6 text-[12.5px] text-ink-3">{emptyMessage}</p>;
  }

  return (
    <div>
      {showModule && modules.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 border-b border-rule px-4 py-2">
          <span className="eyebrow mr-1">Filter</span>
          <button
            type="button"
            onClick={() => setModuleFilter('all')}
            className={cn(
              'rounded-[2px] border px-2 py-0.5 text-[11px]',
              moduleFilter === 'all'
                ? 'border-accent bg-accent text-white'
                : 'border-rule-strong bg-canvas text-ink-3 hover:border-ink-4',
            )}
          >
            All ({findings.length})
          </button>
          {modules.map((module) => {
            const total = findings.filter((finding) => finding.module === module).length;
            return (
              <button
                key={module}
                type="button"
                onClick={() => setModuleFilter(module)}
                className={cn(
                  'rounded-[2px] border px-2 py-0.5 text-[11px]',
                  moduleFilter === module
                    ? 'border-accent bg-accent text-white'
                    : 'border-rule-strong bg-canvas text-ink-3 hover:border-ink-4',
                )}
              >
                {MODULE_LABELS[module]} ({total})
              </button>
            );
          })}
        </div>
      )}

      <ul>
        {visible.map((finding) => {
          const open = openId === finding.id;
          return (
            <li
              key={finding.id}
              id={anchorFor(finding.id)}
              className="scroll-mt-28 border-b border-rule last:border-b-0"
            >
              <button
                type="button"
                onClick={() => toggle(finding)}
                aria-expanded={open}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-canvas-2',
                  open && 'bg-canvas-2',
                )}
              >
                <SeverityBadge severity={finding.severity} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-medium text-ink">
                    {finding.headline}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">
                    {finding.clientFact}
                  </span>
                </span>
                <span className="hidden shrink-0 items-center gap-1.5 pt-0.5 md:flex">
                  {finding.potentialForms.slice(0, 2).map((form) => (
                    <FormTag key={form}>{form}</FormTag>
                  ))}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'shrink-0 pt-1 text-ink-4 transition-transform',
                    open && 'rotate-180',
                  )}
                >
                  <svg width="9" height="6" viewBox="0 0 9 6">
                    <path d="M1 1l3.5 3.5L8 1" fill="none" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                </span>
              </button>
              {open && <FindingDetail finding={finding} rule={rules[finding.ruleId]} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
