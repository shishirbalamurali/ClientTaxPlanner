import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CompositionChart } from '@/components/charts/composition-chart';
import { FindingExplorer } from '@/components/findings/finding-explorer';
import { navHref } from '@/components/shell/nav';
import { Tag } from '@/components/ui/badge';
import { Metric, MetricRow, StatLine } from '@/components/ui/metric';
import { MetaItem, PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { getClient } from '@/data/clients';
import { computeNetWorth } from '@/lib/analysis/executive-summary';
import { compactUsd, pct, usd } from '@/lib/format';
import { FILING_STATUS_SHORT } from '@/lib/labels';
import { MODULE_LABELS, evaluateClient, ruleMetaFor, type FindingModule } from '@/lib/rules';
import { getTaxYear } from '@/lib/tax-year';

export const dynamic = 'force-static';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const client = getClient(clientId);
  if (!client) notFound();

  const constants = getTaxYear(client.taxYear);
  const evaluation = evaluateClient(client, constants);
  const { federal, gifts, trusts, foreign, findings } = evaluation;
  const rules = ruleMetaFor(findings);
  const netWorth = computeNetWorth(client);

  const composition = [
    { label: 'Employment', value: federal.income.breakdown.employment },
    { label: 'Capital gains', value: federal.income.breakdown.capitalGains },
    { label: 'Business', value: federal.income.breakdown.business },
    { label: 'Dividends', value: federal.income.breakdown.dividends },
    { label: 'Interest', value: federal.income.breakdown.interest },
    { label: 'Rental', value: federal.income.breakdown.rental },
    { label: 'Trust distributions', value: federal.income.breakdown.trustDistributions },
    { label: 'Other', value: federal.income.breakdown.other },
  ];

  const moduleCounts = (Object.keys(MODULE_LABELS) as FindingModule[])
    .map((module) => ({
      module,
      label: MODULE_LABELS[module],
      review: findings.filter((f) => f.module === module && f.severity === 'review').length,
      monitor: findings.filter((f) => f.module === module && f.severity === 'monitor').length,
    }))
    .filter((row) => row.review + row.monitor > 0);

  const residenceLabel = client.residency.livesAbroad
    ? `resident in ${client.residency.countryOfResidence ?? 'a foreign country'}`
    : `resident in ${client.residency.stateName}`;

  const moduleLink: Partial<Record<FindingModule, string>> = {
    individual: 'individual-tax',
    deductions: 'individual-tax',
    wealthTransfer: 'wealth-transfer',
    trust: 'trusts',
    foreign: 'foreign-accounts',
    compliance: 'individual-tax',
  };

  return (
    <>
      <PageHeader
        eyebrow={`${constants.label} · ${client.engagementRef}`}
        title={client.displayName}
        summary={`${client.archetypeLabel} filing ${FILING_STATUS_SHORT[client.filingStatus]}, ${residenceLabel}. The rule set raised ${evaluation.reviewCount} review item${evaluation.reviewCount === 1 ? '' : 's'} and ${evaluation.monitorCount} item${evaluation.monitorCount === 1 ? '' : 's'} to monitor across ${moduleCounts.length} modules.`}
        meta={
          <>
            <MetaItem label="Occupation" value={client.occupation} />
            <MetaItem label="Dependents" value={client.dependents.length} />
            <MetaItem label="Modeled net worth" value={compactUsd(netWorth)} />
            <MetaItem label="Prior year AGI" value={usd(client.priorYearAdjustedGrossIncome)} />
          </>
        }
      />

      <MetricRow>
        <Metric
          label="Total modeled income"
          value={usd(federal.income.totalModeledIncome)}
          note={`${pct(federal.income.investmentIncome / federal.income.totalModeledIncome)} from investment sources`}
        />
        <Metric
          label="Modeled federal tax"
          value={usd(federal.totalFederalTax)}
          note={`${pct(federal.effectiveRateOnModeledIncome)} effective, ${pct(federal.marginalOrdinaryRate)} marginal on ordinary income`}
        />
        <Metric
          label="Review items"
          value={String(evaluation.reviewCount)}
          tone={evaluation.reviewCount > 0 ? 'flag' : 'ok'}
          note={`${evaluation.monitorCount} to monitor, ${evaluation.informationalCount} informational`}
        />
        <Metric
          label="Forms implicated"
          value={String(evaluation.potentialForms.length)}
          note={evaluation.potentialForms.slice(0, 4).join(' · ')}
        />
      </MetricRow>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel
          title="Income composition"
          description={`Modeled ${constants.year} income by source, excluding ${usd(federal.income.taxExemptInterest)} of tax-exempt interest.`}
        >
          <CompositionChart data={composition} />
        </Panel>

        <Panel title="Position at a glance">
          <StatLine label="Adjusted gross income" value={usd(federal.adjustedGrossIncome)} />
          <StatLine
            label="Deduction taken"
            value={usd(federal.deductionTaken)}
            note={federal.deductionMethod === 'itemized' ? '(itemized)' : '(standard)'}
          />
          <StatLine label="Taxable income" value={usd(federal.taxableIncome)} emphasis />
          <StatLine label="Net investment income tax" value={usd(federal.netInvestmentIncomeTax)} />
          <StatLine label="Additional Medicare tax" value={usd(federal.additionalMedicareTax)} />
          <StatLine label="Estimated state tax" value={usd(federal.estimatedStateTax)} />
          <div className="mt-3 border-t border-rule pt-3">
            <StatLine label="Transfers during the year" value={usd(gifts.totalGifted)} />
            <StatLine
              label="Above the annual exclusion"
              value={usd(gifts.totalExceedingExclusion)}
              indent
            />
            <StatLine label="Trust income" value={usd(trusts.totalGrossIncome)} />
            <StatLine label="Retained in trust" value={usd(trusts.totalRetainedIncome)} indent />
            <StatLine
              label="Foreign accounts, aggregate maximum"
              value={foreign.accountCount === 0 ? '—' : usd(foreign.aggregateMaximumValue)}
            />
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Panel title="Findings by module" bodyClassName="p-0">
          <ul>
            {moduleCounts.map((row) => (
              <li key={row.module} className="border-b border-rule last:border-b-0">
                <Link
                  href={navHref(clientId, moduleLink[row.module] ?? 'research')}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-canvas-2"
                >
                  <span className="text-[12.5px] text-ink-2">{row.label}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {row.review > 0 && (
                      <span className="tnum rounded-[2px] border border-flag/30 bg-flag-wash px-1.5 py-px text-[10.5px] font-semibold text-flag">
                        {row.review} review
                      </span>
                    )}
                    {row.monitor > 0 && (
                      <span className="tnum rounded-[2px] border border-warn/30 bg-warn-wash px-1.5 py-px text-[10.5px] font-semibold text-warn">
                        {row.monitor} monitor
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Review items"
          description="Every item is produced by a deterministic rule. Expand a row to trace it back to the client fact and the government source."
          bodyClassName="p-0"
          footnote={
            <>
              Exceeding a modeled threshold indicates that a filing position needs to be reviewed by
              a qualified professional. It does not establish that a form is required or that tax is
              owed.
            </>
          }
        >
          <FindingExplorer
            findings={findings.filter((finding) => finding.severity === 'review')}
            rules={rules}
            emptyMessage="No review items were raised on the modeled facts."
          />
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Engagement notes"
        description="Working notes carried on the client file. These are inputs to the analysis, not conclusions of it."
      >
        <ul className="space-y-2">
          {client.advisorNotes.map((note) => (
            <li key={note} className="flex gap-2.5 text-[12.5px] leading-relaxed text-ink-2">
              <span aria-hidden className="pt-px text-ink-4">
                —
              </span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-rule pt-3">
          {evaluation.potentialForms.map((form) => (
            <Tag key={form}>{form}</Tag>
          ))}
        </div>
      </Panel>
    </>
  );
}
