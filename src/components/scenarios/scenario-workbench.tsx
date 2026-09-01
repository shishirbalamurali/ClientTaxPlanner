'use client';

import { Fragment, useMemo, useState } from 'react';
import { GroupedBarChart } from '@/components/charts/grouped-bar-chart';
import { CitationList } from '@/components/ui/citation';
import { Panel } from '@/components/ui/panel';
import { Table, TableWrap, Td, Th } from '@/components/ui/table';
import { cn } from '@/lib/cn';
import { pct, signed, usd } from '@/lib/format';
import {
  DEFAULT_SCENARIO_PARAMETERS,
  SCENARIO_ROWS,
  buildScenarios,
  type ScenarioParameters,
} from '@/lib/analysis/scenarios';
import { getTaxYear } from '@/lib/tax-year';
import type { Client } from '@/lib/types';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow block">{label}</span>
      <span className="mt-1.5 block">{children}</span>
      {hint && <span className="mt-1 block text-[11px] leading-snug text-ink-4">{hint}</span>}
    </label>
  );
}

const numberInputClass =
  'tnum w-full rounded-[3px] border border-rule-strong bg-canvas px-2 py-1 text-[12.5px] text-ink focus:border-accent-2';

export function ScenarioWorkbench({ client }: { client: Client }) {
  const [parameters, setParameters] = useState<ScenarioParameters>(DEFAULT_SCENARIO_PARAMETERS);
  const constants = useMemo(() => getTaxYear(client.taxYear), [client.taxYear]);
  const comparison = useMemo(
    () => buildScenarios(client, constants, parameters),
    [client, constants, parameters],
  );

  const { scenarios, baseline } = comparison;
  const set = <K extends keyof ScenarioParameters>(key: K, value: ScenarioParameters[K]) =>
    setParameters((previous) => ({ ...previous, [key]: value }));

  const groups = [...new Set(SCENARIO_ROWS.map((row) => row.group))];

  const taxChartData = scenarios.map((scenario) => ({
    scenario: scenario.shortName,
    federal: scenario.metrics.totalFederalTax,
    state: scenario.metrics.estimatedStateTax,
  }));

  return (
    <>
      <Panel
        title="Scenario assumptions"
        description="Each lever changes one input and re-runs the same model, so the difference between columns is attributable to that lever alone."
        className="mb-4"
      >
        <div className="grid gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
          <Field
            label="Gift planning"
            hint={`Doubles the exclusion available per donee to ${usd(constants.wealthTransfer.annualGiftExclusion * 2)}.`}
          >
            <span className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 text-[12.5px] text-ink-2">
                <input
                  type="checkbox"
                  checked={parameters.electGiftSplitting}
                  onChange={(event) => set('electGiftSplitting', event.target.checked)}
                  className="accent-[#1b3b5f]"
                />
                Elect gift splitting
              </span>
              <span className="flex items-center gap-2 text-[12.5px] text-ink-2">
                <input
                  type="checkbox"
                  checked={parameters.topUpDoneesToExclusion}
                  onChange={(event) => set('topUpDoneesToExclusion', event.target.checked)}
                  className="accent-[#1b3b5f]"
                />
                Top donees up to the exclusion
              </span>
            </span>
          </Field>

          <Field label="Additional donees" hint="Hypothetical donees added at the full exclusion.">
            <input
              type="number"
              min={0}
              max={8}
              value={parameters.additionalDonees}
              onChange={(event) =>
                set('additionalDonees', Math.max(0, Math.min(8, Number(event.target.value) || 0)))
              }
              className={numberInputClass}
            />
          </Field>

          <Field
            label="Incremental appreciated gift"
            hint={`Measured against the ${pct(constants.charitableAgiLimits.appreciatedPropertyToPublicCharity, 1)} of contribution base ceiling.`}
          >
            <input
              type="number"
              min={0}
              step={50_000}
              value={parameters.incrementalAppreciatedGift}
              onChange={(event) =>
                set('incrementalAppreciatedGift', Math.max(0, Number(event.target.value) || 0))
              }
              className={numberInputClass}
            />
          </Field>

          <Field
            label={`Capital gain deferred — ${(parameters.capitalGainDeferralShare * 100).toFixed(0)}%`}
            hint={`${usd(client.income.longTermCapitalGain * parameters.capitalGainDeferralShare)} of the ${usd(client.income.longTermCapitalGain)} modeled long-term gain.`}
          >
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={parameters.capitalGainDeferralShare * 100}
              onChange={(event) => set('capitalGainDeferralShare', Number(event.target.value) / 100)}
              className="w-full accent-[#1b3b5f]"
            />
          </Field>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-rule pt-3">
          <p className="text-[11.5px] text-ink-4">
            Adjusting a control recomputes every column immediately. Nothing is saved.
          </p>
          <button
            type="button"
            onClick={() => setParameters(DEFAULT_SCENARIO_PARAMETERS)}
            className="rounded-[3px] border border-rule-strong bg-canvas px-2.5 py-1 text-[11.5px] text-ink-3 hover:border-ink-4 hover:text-ink"
          >
            Reset to defaults
          </button>
        </div>
      </Panel>

      <div className="mb-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {scenarios.map((scenario) => (
          <section key={scenario.key} className="border border-rule bg-canvas p-4">
            <div className="eyebrow">{scenario.key === 'current' ? 'Baseline' : 'Scenario'}</div>
            <h3 className="mt-1 text-[13px] font-semibold text-ink">{scenario.name}</h3>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">{scenario.premise}</p>
            <ul className="mt-2.5 space-y-1 border-t border-rule pt-2.5">
              {scenario.assumptions.map((assumption) => (
                <li key={assumption} className="flex gap-1.5 text-[11px] leading-snug text-ink-3">
                  <span aria-hidden className="text-ink-4">
                    —
                  </span>
                  <span>{assumption}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <Panel
        title="Side-by-side comparison"
        description="Differences are shown against the current position. A dash means the value is unchanged."
        bodyClassName="p-0"
        footnote={
          <CitationList
            ids={[
              'rp-2024-40-annual-gift-exclusion',
              'irc-170b-agi-limits',
              'rp-2024-40-capital-gains',
              'irc-1411-niit',
            ]}
          />
        }
      >
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th className="min-w-[280px]">Measure</Th>
                {scenarios.map((scenario) => (
                  <Th key={scenario.key} numeric className="min-w-[150px]">
                    {scenario.name}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <Fragment key={group}>
                  <tr className="bg-canvas-3">
                    <Td
                      colSpan={scenarios.length + 1}
                      className="py-1 text-[10px] font-semibold tracking-[0.08em] text-ink-3 uppercase"
                    >
                      {group}
                    </Td>
                  </tr>
                  {SCENARIO_ROWS.filter((row) => row.group === group).map((row) => (
                    <tr key={row.key}>
                      <Td>{row.label}</Td>
                      {scenarios.map((scenario) => {
                        const value = scenario.metrics[row.key];
                        const base = baseline.metrics[row.key];
                        const delta = value - base;
                        const isBaseline = scenario.key === 'current';
                        const unchanged = Math.abs(delta) < 0.5;
                        const tone =
                          unchanged || row.direction === 'neutral'
                            ? 'text-ink-4'
                            : (row.direction === 'lowerIsBetter' ? delta < 0 : delta > 0)
                              ? 'text-ok'
                              : 'text-flag';
                        return (
                          <Td key={scenario.key} numeric>
                            <span className="block">
                              {row.format === 'usd' ? usd(value) : pct(value, 2)}
                            </span>
                            {!isBaseline && (
                              <span className={cn('mt-0.5 block text-[11px]', tone)}>
                                {unchanged
                                  ? '—'
                                  : row.format === 'usd'
                                    ? signed(delta)
                                    : `${delta > 0 ? '+' : '−'}${pct(Math.abs(delta), 2)}`}
                              </span>
                            )}
                          </Td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Panel>

      <Panel
        className="mt-4"
        title="Modeled tax by scenario"
        description="Federal tax from the model plus the state estimate, which applies a single top marginal rate and is not a state return calculation."
      >
        <GroupedBarChart
          data={taxChartData}
          categoryKey="scenario"
          height={240}
          series={[
            { key: 'federal', label: 'Modeled federal tax', stackId: 'tax' },
            { key: 'state', label: 'Estimated state tax', stackId: 'tax' },
          ]}
        />
      </Panel>
    </>
  );
}
