'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { getAuthorities } from '@/lib/research/authorities';
import { MODULE_LABELS, type RuleMeta } from '@/lib/rules';
import { Table, TableWrap, Td, Th } from '@/components/ui/table';

export function RuleCatalogTable({
  rules,
  firedRuleIds,
}: {
  rules: RuleMeta[];
  firedRuleIds: string[];
}) {
  const [onlyFired, setOnlyFired] = useState(false);
  const fired = new Set(firedRuleIds);
  const rows = onlyFired ? rules.filter((rule) => fired.has(rule.id)) : rules;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2">
        <p className="text-[11.5px] text-ink-3">
          {rules.length} rules in the set. {fired.size} produced a finding for this client.
        </p>
        <button
          type="button"
          onClick={() => setOnlyFired((value) => !value)}
          className={cn(
            'rounded-[2px] border px-2 py-0.5 text-[11px]',
            onlyFired
              ? 'border-accent bg-accent text-white'
              : 'border-rule-strong bg-canvas text-ink-3 hover:border-ink-4',
          )}
        >
          {onlyFired ? 'Showing rules that fired' : 'Show only rules that fired'}
        </button>
      </div>
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>Rule</Th>
              <Th>Module</Th>
              <Th>Deterministic test</Th>
              <Th>Authorities</Th>
              <Th>This client</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((rule) => (
              <tr key={rule.id}>
                <Td>
                  <span className="tnum block font-mono text-[11px] text-ink-4">{rule.id}</span>
                  <span className="block font-medium text-ink">{rule.name}</span>
                  <span className="mt-0.5 block max-w-md text-[11.5px] leading-snug text-ink-3">
                    {rule.description}
                  </span>
                </Td>
                <Td className="text-ink-3">
                  {MODULE_LABELS[rule.module as keyof typeof MODULE_LABELS] ?? rule.module}
                </Td>
                <Td className="max-w-xs font-mono text-[11px] text-ink-2">{rule.test}</Td>
                <Td>
                  <ul className="space-y-0.5">
                    {getAuthorities(rule.authorityIds).map((authority) => (
                      <li key={authority.id}>
                        <a
                          href={authority.sourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-[11.5px] text-accent-2 underline decoration-rule-strong underline-offset-2 hover:decoration-accent-2"
                        >
                          {authority.citation}
                        </a>
                      </li>
                    ))}
                  </ul>
                </Td>
                <Td>
                  {fired.has(rule.id) ? (
                    <span className="inline-block rounded-[2px] border border-flag/30 bg-flag-wash px-1.5 py-px text-[10.5px] font-semibold text-flag">
                      Fired
                    </span>
                  ) : (
                    <span className="text-[11.5px] text-ink-4">Not triggered</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </div>
  );
}
