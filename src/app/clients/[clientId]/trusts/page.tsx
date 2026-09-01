import { notFound } from 'next/navigation';
import { CompositionChart } from '@/components/charts/composition-chart';
import { GroupedBarChart } from '@/components/charts/grouped-bar-chart';
import { FindingExplorer } from '@/components/findings/finding-explorer';
import { Tag } from '@/components/ui/badge';
import { CitationList } from '@/components/ui/citation';
import { Metric, MetricRow, StatLine } from '@/components/ui/metric';
import { MetaItem, PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Table, TableWrap, Td, Th, TotalRow } from '@/components/ui/table';
import { getClient } from '@/data/clients';
import { pct, usd, usdAccounting } from '@/lib/format';
import { TRUST_KIND_LABELS } from '@/lib/labels';
import { evaluateClient, ruleMetaFor } from '@/lib/rules';
import { getTaxYear } from '@/lib/tax-year';

export const dynamic = 'force-static';

export default async function TrustsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const client = getClient(clientId);
  if (!client) notFound();

  const constants = getTaxYear(client.taxYear);
  const evaluation = evaluateClient(client, constants);
  const { trusts, findings } = evaluation;
  const rules = ruleMetaFor(findings);
  const relevant = findings.filter((finding) => finding.module === 'trust');

  const distributionData = trusts.trusts.map((summary) => ({
    trust:
      summary.trust.name.length > 24
        ? `${summary.trust.name.slice(0, 22)}…`
        : summary.trust.name,
    distributed: summary.distributions,
    retained: summary.retainedIncome,
  }));

  if (client.trusts.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Trusts"
          title="Form 1041 fiduciary dashboard"
          summary="No trusts are recorded on this client file, so no fiduciary analysis is produced."
        />
        <Panel title="No trusts on file">
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            The module reports composition, distributions and retained income for trusts carried on
            the client record. Add a trust to the record to populate it.
          </p>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Trusts"
        title="Form 1041 fiduciary dashboard"
        summary={`Income composition, distributions and retained income for each trust on file. This module is informational: it does not compute distributable net income, apply the separate share rules, or produce a Form 1041. The fiduciary tax shown is an illustration of the compressed rate schedule applied to modeled retained income.`}
        meta={
          <>
            <MetaItem label="Trusts" value={client.trusts.length} />
            <MetaItem label="Top fiduciary bracket begins" value={usd(trusts.topBracketThreshold)} />
            <MetaItem label="Filing threshold" value={usd(trusts.filingThreshold)} />
            <MetaItem label="Aggregate principal" value={usd(trusts.totalPrincipal)} />
          </>
        }
      />

      <MetricRow>
        <Metric label="Trust gross income" value={usd(trusts.totalGrossIncome)} />
        <Metric label="Distributed to beneficiaries" value={usd(trusts.totalDistributions)} note={trusts.totalGrossIncome > 0 ? `${pct(trusts.totalDistributions / trusts.totalGrossIncome)} of gross income` : undefined} />
        <Metric label="Retained in trust" value={usd(trusts.totalRetainedIncome)} tone={trusts.totalRetainedIncome > trusts.topBracketThreshold ? 'warn' : 'default'} />
        <Metric label="Illustrative fiduciary tax" value={usd(trusts.totalIllustrativeFiduciaryTax)} note="Compressed rates applied to modeled retained income" />
      </MetricRow>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel
          title="Trust income by category"
          description="Aggregated across every trust on file."
        >
          <CompositionChart
            data={[
              { label: 'Interest', value: trusts.incomeByCategory.interest },
              { label: 'Dividends', value: trusts.incomeByCategory.dividends },
              { label: 'Capital gains', value: trusts.incomeByCategory.capitalGains },
              { label: 'Rental income', value: trusts.incomeByCategory.rental },
              { label: 'Other income', value: trusts.incomeByCategory.other },
            ]}
          />
        </Panel>

        <Panel
          title="Distributed against retained"
          description="Income carried out to beneficiaries versus income left at the fiduciary level."
        >
          <GroupedBarChart
            data={distributionData}
            categoryKey="trust"
            height={222}
            series={[
              { key: 'distributed', label: 'Distributed to beneficiaries', stackId: 'income' },
              { key: 'retained', label: 'Retained in trust', stackId: 'income' },
            ]}
          />
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Trust detail"
        bodyClassName="p-0"
        footnote={
          <CitationList
            ids={['rp-2024-40-estates-trusts', 'irs-i1041-filing-threshold', 'irc-661-distribution-deduction']}
          />
        }
      >
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Trust</Th>
                <Th numeric>Interest</Th>
                <Th numeric>Dividends</Th>
                <Th numeric>Capital gains</Th>
                <Th numeric>Rental</Th>
                <Th numeric>Other</Th>
                <Th numeric>Gross income</Th>
                <Th numeric>Distributions</Th>
                <Th numeric>Retained</Th>
              </tr>
            </thead>
            <tbody>
              {trusts.trusts.map((summary) => (
                <tr key={summary.trust.id}>
                  <Td>
                    <span className="font-medium text-ink">{summary.trust.name}</span>
                    <div className="mt-0.5 text-[11.5px] text-ink-3">
                      {TRUST_KIND_LABELS[summary.trust.kind]} · {summary.trust.situs}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {summary.isGrantorTrust && <Tag>Grantor</Tag>}
                      {summary.trust.isForeignTrust && <Tag>Foreign</Tag>}
                      {summary.trust.hasNonresidentAlienBeneficiary && <Tag>NRA beneficiary</Tag>}
                    </div>
                  </Td>
                  <Td numeric>{usdAccounting(summary.trust.income.interest)}</Td>
                  <Td numeric>{usdAccounting(summary.trust.income.dividends)}</Td>
                  <Td numeric>{usdAccounting(summary.trust.income.capitalGains)}</Td>
                  <Td numeric>{usdAccounting(summary.trust.income.rental)}</Td>
                  <Td numeric>{usdAccounting(summary.trust.income.other)}</Td>
                  <Td numeric className="font-semibold text-ink">{usd(summary.grossIncome)}</Td>
                  <Td numeric>{usdAccounting(summary.distributions)}</Td>
                  <Td numeric>{usdAccounting(summary.retainedIncome)}</Td>
                </tr>
              ))}
              <TotalRow>
                <Td>Total</Td>
                <Td numeric>{usd(trusts.incomeByCategory.interest)}</Td>
                <Td numeric>{usd(trusts.incomeByCategory.dividends)}</Td>
                <Td numeric>{usd(trusts.incomeByCategory.capitalGains)}</Td>
                <Td numeric>{usd(trusts.incomeByCategory.rental)}</Td>
                <Td numeric>{usd(trusts.incomeByCategory.other)}</Td>
                <Td numeric>{usd(trusts.totalGrossIncome)}</Td>
                <Td numeric>{usd(trusts.totalDistributions)}</Td>
                <Td numeric>{usd(trusts.totalRetainedIncome)}</Td>
              </TotalRow>
            </tbody>
          </Table>
        </TableWrap>
      </Panel>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        {trusts.trusts.map((summary) => (
          <Panel
            key={summary.trust.id}
            title={summary.trust.name}
            description={`${TRUST_KIND_LABELS[summary.trust.kind]} · trustee ${summary.trust.trustee}`}
          >
            <StatLine label="Principal value" value={usd(summary.trust.principalValue)} />
            <StatLine label="Gross income" value={usd(summary.grossIncome)} />
            <StatLine label="Fiduciary fees and state taxes" value={usdAccounting(-summary.deductibleExpenses)} indent />
            <StatLine label="Distributions to beneficiaries" value={usdAccounting(-summary.distributions)} indent />
            <StatLine label="Retained income" value={usd(summary.retainedIncome)} emphasis />
            <StatLine
              label="Modeled fiduciary accounting income"
              value={usd(summary.netAccountingIncome)}
              note={summary.trust.capitalGainsAllocatedToIncome ? '(gains in income)' : '(gains to principal)'}
            />
            <StatLine
              label="Undistributed investment income"
              value={usd(summary.undistributedInvestmentIncome)}
            />
            <StatLine
              label="Illustrative fiduciary tax"
              value={
                summary.isGrantorTrust
                  ? 'Taxed to grantor'
                  : summary.isTaxExempt
                    ? 'Generally exempt'
                    : usd(summary.illustrativeFiduciaryTax)
              }
            />
            <StatLine
              label="Distribution rate"
              value={summary.grossIncome > 0 ? pct(summary.distributionRate) : '—'}
            />
            <div className="mt-3 border-t border-rule pt-2 text-[11.5px] leading-relaxed text-ink-3">
              Beneficiaries: {summary.trust.beneficiaries.join(', ')}.
            </div>
          </Panel>
        ))}
      </div>

      <Panel
        className="mt-4"
        title="Fiduciary review items"
        bodyClassName="p-0"
        footnote={
          <>
            Distributable net income, the separate share rules, the § 663(b) sixty-five day election
            and the trust’s own accounting income under local law all bear on the outcome and are not
            modeled here. Figures are a starting point for the fiduciary’s preparer, not a
            substitute for one.
          </>
        }
      >
        <FindingExplorer
          findings={relevant}
          rules={rules}
          showModule={false}
          emptyMessage="No fiduciary review items were raised on the modeled facts."
        />
      </Panel>
    </>
  );
}
