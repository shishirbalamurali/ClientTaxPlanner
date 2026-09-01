'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import {
  AUTHORITIES,
  AUTHORITY_CATEGORY_LABELS,
  AUTHORITY_KIND_LABELS,
} from '@/lib/research/authorities';
import type { AuthorityCategory } from '@/lib/research/types';
import { FormTag, Tag } from '@/components/ui/badge';

const CATEGORY_ORDER: AuthorityCategory[] = [
  'individualIncome',
  'investmentIncome',
  'deductions',
  'wealthTransfer',
  'fiduciary',
  'international',
  'compliance',
];

export function AuthorityBrowser({ taxYear }: { taxYear: number }) {
  const [category, setCategory] = useState<AuthorityCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return AUTHORITIES.filter((authority) => {
      if (category !== 'all' && authority.category !== category) return false;
      if (!needle) return true;
      return [
        authority.topic,
        authority.citation,
        authority.ruleDescription,
        authority.governmentSource,
        authority.relatedForms.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [category, query]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-rule px-4 py-2.5">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search topic, citation or form"
          className="w-56 rounded-[3px] border border-rule-strong bg-canvas px-2 py-1 text-[12px] text-ink placeholder:text-ink-4 focus:border-accent-2"
        />
        <span className="eyebrow ml-1">Category</span>
        <button
          type="button"
          onClick={() => setCategory('all')}
          className={cn(
            'rounded-[2px] border px-2 py-0.5 text-[11px]',
            category === 'all'
              ? 'border-accent bg-accent text-white'
              : 'border-rule-strong bg-canvas text-ink-3 hover:border-ink-4',
          )}
        >
          All ({AUTHORITIES.length})
        </button>
        {CATEGORY_ORDER.map((key) => {
          const total = AUTHORITIES.filter((authority) => authority.category === key).length;
          if (total === 0) return null;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={cn(
                'rounded-[2px] border px-2 py-0.5 text-[11px]',
                category === key
                  ? 'border-accent bg-accent text-white'
                  : 'border-rule-strong bg-canvas text-ink-3 hover:border-ink-4',
              )}
            >
              {AUTHORITY_CATEGORY_LABELS[key]} ({total})
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-[12.5px] text-ink-3">
          Nothing in the library matches that search.
        </p>
      ) : (
        <ul>
          {rows.map((authority) => (
            <li key={authority.id} className="border-b border-rule px-4 py-3 last:border-b-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-[12.5px] font-semibold text-ink">{authority.topic}</h3>
                <span className="tnum text-[11px] text-ink-4">
                  Tax year {authority.taxYear === 'all' ? 'all years' : authority.taxYear}
                  {authority.taxYear !== 'all' && authority.taxYear !== taxYear && ' (not the modeled year)'}
                  {' · verified '}
                  {formatDate(authority.lastVerified)}
                </span>
              </div>
              <p className="mt-1 max-w-4xl text-[12.5px] leading-relaxed text-ink-2">
                {authority.ruleDescription}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <a
                  href={authority.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[12px] font-medium text-accent-2 underline decoration-rule-strong underline-offset-2 hover:decoration-accent-2"
                >
                  {authority.citation}
                </a>
                <span className="text-[11.5px] text-ink-4">{authority.governmentSource}</span>
                <Tag>{AUTHORITY_KIND_LABELS[authority.kind]}</Tag>
                {authority.relatedForms.map((form) => (
                  <FormTag key={form}>{form}</FormTag>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
