import { notFound } from 'next/navigation';
import { CompositionChart } from '@/components/charts/composition-chart';
import { StackedShareChart } from '@/components/charts/stacked-share-chart';
import { FindingExplorer } from '@/components/findings/finding-explorer';
import { CitationList } from '@/components/ui/citation';
import { Metric, MetricRow, StatLine } from '@/components/ui/metric';
import { MetaItem, PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Table, TableWrap, Td, Th, TotalRow } from '@/components/ui/table';
import { getClient } from '@/data/clients';
import { MODEL_LIMITATIONS } from '@/lib/analysis/federal-model';
import { pct, usd, usdAccounting } from '@/lib/format';
import { FILING_STATUS_LABELS } from '@/lib/labels';
import { evaluateClient, ruleMetaFor } from '@/lib/rules';
import { getTaxYear } from '@/lib/tax-year';

export const dynamic = 'force-static';

export default async function IndividualTaxPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const client = getClient(clientId);
  if (!client) notFound();

  const constants = getTaxYear(client.taxYear);
  const evaluation = evaluateClient(client, constants);
  const { federal, findings } = evaluation;
  const income = federal.income;
  const rules = ruleMetaFor(findings);

  const relevant = findings.filter((finding) =>
    ['individual', 'deductions', 'compliance'].includes(finding.module),
  );

  const brackets = constants.ordinaryRates[client.filingStatus];
  const breakpoints = constants.capitalGainBreakpoints[client.filingStatus];
  const niitThreshold = constants.netInvestmentIncomeTax.thresholds[client.filingStatus];

  const bracketLayers = brackets.map((bracket, index) => {
    const ceiling = brackets[index + 1]?.floor ?? Number.POSITIVE_INFINITY;
    const inBracket = Math.max(
      0,
      Math.min(federal.ordinaryTaxableIncome, ceiling) - bracket.floor,
    );
    return { rate: bracket.rate, floor: bracket.floor, ceiling, inBracket, tax: inBracket * bracket.rate };
  });

  const taxComposition = [
    { label: 'Ordinary income tax', value: federal.ordinaryTax },
    { label: 'Capital gain and qualified dividends', value: federal.capitalGainTax },
    { label: 'Net investment income tax', value: federal.netInvestmentIncomeTax },
    { label: 'Additional Medicare tax', value: federal.additionalMedicareTax },
  ];

  const investmentLines: Array<[string, number]> = [
    ['Taxable interest', client.income.taxableInterest],
    ['Qualified dividends', client.income.qualifiedDividends],
    ['Non-qualified dividends', client.income.nonQualifiedDividends],
    ['Short-term capital gain', client.income.shortTermCapitalGain],
    ['Long-term capital gain', client.income.longTermCapitalGain],
    ['Rental income', client.income.rentalIncome],
    ['Trust distributions', client.income.trustDistributions],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Individual tax"
        title="Form 1040 income analysis"
        summary="A high-level view of how the modeled year composes, where it sits against the rate schedules, and which positions need a preparer's judgement. This is an analytical model, not return preparation software: it does not produce a return, apply credits, or compute alternative minimum tax."
        meta={
          <>
            <MetaItem label="Filing status" value={FILING_STATUS_LABELS[client.filingStatus]} />
            <MetaItem label="Tax year" value={constants.year} />
            <MetaItem label="Marginal ordinary rate" value={pct(federal.marginalOrdinaryRate)} />
            <MetaItem label="Deduction method" value={federal.deductionMethod === 'itemized' ? 'Itemized' : 'Standard'} />
          </>
        }
      />

      <MetricRow>
        <Metric label="Total modeled income" value={usd(income.totalModeledIncome)} note={`Plus ${usd(income.taxExemptInterest)} of tax-exempt interest`} />
        <Metric label="Taxable income" value={usd(federal.taxableIncome)} note={`After a ${usd(federal.deductionTaken)} deduction`} />
        <Metric label="Modeled federal tax" value={usd(federal.totalFederalTax)} note={`${pct(federal.effectiveRateOnModeledIncome)} of total modeled income`} />
        <Metric label="Investment income" value={usd(income.investmentIncome)} note={`${pct(income.investmentIncome / income.totalModeledIncome)} of modeled income`} />
      </MetricRow>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel
          title="Income composition"
          description="Ordered by size. Tax-exempt interest is excluded from the total but tracked separately for the alternative minimum tax screen."
        >
          <CompositionChart
            data={[
              { label: 'Employment', value: income.breakdown.employment },
              { label: 'Capital gains', value: income.breakdown.capitalGains },
              { label: 'Business', value: income.breakdown.business },
              { label: 'Dividends', value: income.breakdown.dividends },
              { label: 'Interest', value: income.breakdown.interest },
              { label: 'Rental', value: income.breakdown.rental },
              { label: 'Trust distributions', value: income.breakdown.trustDistributions },
              { label: 'Retirement', value: income.breakdown.retirement },
              { label: 'Other', value: income.breakdown.other },
            ]}
          />
        </Panel>

        <Panel
          title="Character of income"
          description="Preferential income stacks above ordinary income when the rate bands are applied."
        >
          <StackedShareChart
            segments={[
              { label: 'Ordinary', value: income.ordinaryIncome },
              { label: 'Long-term gain and qualified dividends', value: income.preferentialIncome },
            ]}
          />
          <div className="mt-5 border-t border-rule pt-3">
            <StatLine label="Ordinary income" value={usd(income.ordinaryIncome)} />
            <StatLine label="Preferential income" value={usd(income.preferentialIncome)} />
            <StatLine label="Earned income" value={usd(income.earnedIncome)} />
            <StatLine label="Net capital gain" value={usd(income.netCapitalGain)} />
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Panel
          title="Investment income"
          description={`Amounts feeding the net investment income tax base. The § 1411 threshold for this filing status is ${usd(niitThreshold)}.`}
          bodyClassName="p-0"
          footnote={<CitationList ids={['irc-1411-niit', 'irs-i8960-niit-computation']} />}
        >
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Component</Th>
                  <Th numeric>Amount</Th>
                  <Th numeric>Share</Th>
                </tr>
              </thead>
              <tbody>
                {investmentLines.map(([label, amount]) => (
                  <tr key={label} className={amount === 0 ? 'text-ink-4' : undefined}>
                    <Td>{label}</Td>
                    <Td numeric>{usdAccounting(amount)}</Td>
                    <Td numeric>
                      {income.investmentIncome > 0 ? pct(amount / income.investmentIncome) : '—'}
                    </Td>
                  </tr>
                ))}
                <TotalRow>
                  <Td>Modeled net investment income</Td>
                  <Td numeric>{usd(income.netInvestmentIncome)}</Td>
                  <Td numeric>100.0%</Td>
                </TotalRow>
                <tr>
                  <Td>Adjusted gross income above the threshold</Td>
                  <Td numeric>{usdAccounting(Math.max(0, federal.adjustedGrossIncome - niitThreshold))}</Td>
                  <Td numeric>—</Td>
                </tr>
                <TotalRow>
                  <Td>Base subject to the 3.8% tax</Td>
                  <Td numeric>{usd(federal.netInvestmentIncomeTaxBase)}</Td>
                  <Td numeric>{usd(federal.netInvestmentIncomeTax)}</Td>
                </TotalRow>
              </tbody>
            </Table>
          </TableWrap>
        </Panel>

        <Panel
          title="Capital gain rate bands"
          description="Long-term gain and qualified dividends are stacked on top of ordinary taxable income to determine the applicable band."
          bodyClassName="p-0"
          footnote={<CitationList ids={['rp-2024-40-capital-gains', 'irs-tc409-capital-gains']} />}
        >
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Band</Th>
                  <Th numeric>Taxable income ceiling</Th>
                  <Th numeric>Gain in band</Th>
                  <Th numeric>Tax</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>0%</Td>
                  <Td numeric>{usd(breakpoints.maximumZeroRateAmount)}</Td>
                  <Td numeric>{usdAccounting(federal.capitalGainDetail.atZero)}</Td>
                  <Td numeric>{usdAccounting(0)}</Td>
                </tr>
                <tr>
                  <Td>15%</Td>
                  <Td numeric>{usd(breakpoints.maximumFifteenPercentAmount)}</Td>
                  <Td numeric>{usdAccounting(federal.capitalGainDetail.atFifteen)}</Td>
                  <Td numeric>{usdAccounting(federal.capitalGainDetail.atFifteen * 0.15)}</Td>
                </tr>
                <tr>
                  <Td>20%</Td>
                  <Td numeric className="text-ink-4">above</Td>
                  <Td numeric>{usdAccounting(federal.capitalGainDetail.atTwenty)}</Td>
                  <Td numeric>{usdAccounting(federal.capitalGainDetail.atTwenty * 0.2)}</Td>
                </tr>
                <TotalRow>
                  <Td colSpan={2}>Total</Td>
                  <Td numeric>{usd(federal.preferentialTaxableIncome)}</Td>
                  <Td numeric>{usd(federal.capitalGainTax)}</Td>
                </TotalRow>
              </tbody>
            </Table>
          </TableWrap>
          <div className="border-t border-rule px-4 py-3 text-[11.5px] leading-relaxed text-ink-3">
            Short-term gain of {usd(income.shortTermCapitalGain)} receives no preferential rate and
            is included in ordinary income above. With the net investment income tax the combined
            federal rate on the 20% band is 23.8%.
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Panel
          title="Deductions"
          description="Limitations are applied in the order the statute applies them, and the model takes the larger of itemized or standard."
          footnote={
            <CitationList
              ids={['pl-119-21-salt-cap', 'irc-170b-agi-limits', 'pl-119-21-standard-deduction']}
            />
          }
        >
          <div className="eyebrow mb-1.5">State and local taxes</div>
          <StatLine label="Paid" value={usd(federal.salt.paid)} />
          <StatLine label={`Statutory cap`} value={usd(constants.saltLimitation.cap[client.filingStatus])} indent />
          <StatLine
            label={`Reduction for income above ${usd(constants.saltLimitation.phaseDownModifiedAgiThreshold[client.filingStatus])}`}
            value={usdAccounting(-federal.salt.capReducedBy)}
            indent
          />
          <StatLine label="Cap after phase-down" value={usd(federal.salt.cap)} />
          <StatLine label="Deductible" value={usd(federal.salt.allowed)} emphasis />

          <div className="eyebrow mt-4 mb-1.5">Charitable contributions</div>
          <StatLine
            label={`Cash to public charities (${pct(constants.charitableAgiLimits.cashToPublicCharity, 1)} ceiling)`}
            value={usd(federal.charitable.cash)}
          />
          <StatLine label="Allowed" value={usd(federal.charitable.cashAllowed)} indent />
          <StatLine
            label={`Appreciated securities (${pct(constants.charitableAgiLimits.appreciatedPropertyToPublicCharity, 1)} ceiling)`}
            value={usd(federal.charitable.appreciated)}
          />
          <StatLine label="Allowed" value={usd(federal.charitable.appreciatedAllowed)} indent />
          <StatLine
            label={`Private foundation (${pct(constants.charitableAgiLimits.cashToPrivateFoundation, 1)} ceiling)`}
            value={usd(federal.charitable.privateFoundation)}
          />
          <StatLine label="Allowed" value={usd(federal.charitable.privateFoundationAllowed)} indent />
          <StatLine label="Currently deductible" value={usd(federal.charitable.totalAllowed)} emphasis />
          <StatLine
            label={`Carried forward (up to ${constants.charitableAgiLimits.carryforwardYears} years)`}
            value={usd(federal.charitable.disallowedCarryforward)}
            indent
          />

          <div className="eyebrow mt-4 mb-1.5">Deduction taken</div>
          <StatLine label="Total itemized" value={usd(federal.itemizedDeductions)} />
          <StatLine label="Standard deduction" value={usd(federal.standardDeduction)} />
          <StatLine
            label={federal.deductionMethod === 'itemized' ? 'Itemized deduction taken' : 'Standard deduction taken'}
            value={usd(federal.deductionTaken)}
            emphasis
          />
        </Panel>

        <Panel
          title="Tax build-up"
          description="How the modeled liability decomposes, followed by the ordinary bracket layers."
          footnote={<CitationList ids={['rp-2024-40-rate-schedules', 'irc-3101b-additional-medicare']} />}
        >
          <StackedShareChart segments={taxComposition} legend="amount" />

          <div className="mt-5 border-t border-rule pt-2">
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Rate</Th>
                    <Th numeric>Bracket floor</Th>
                    <Th numeric>Income in bracket</Th>
                    <Th numeric>Tax</Th>
                  </tr>
                </thead>
                <tbody>
                  {bracketLayers.map((layer) => (
                    <tr key={layer.rate} className={layer.inBracket === 0 ? 'text-ink-4' : undefined}>
                      <Td>{pct(layer.rate, 1)}</Td>
                      <Td numeric>{usd(layer.floor)}</Td>
                      <Td numeric>{usdAccounting(layer.inBracket)}</Td>
                      <Td numeric>{usdAccounting(layer.tax)}</Td>
                    </tr>
                  ))}
                  <TotalRow>
                    <Td colSpan={2}>Ordinary income tax</Td>
                    <Td numeric>{usd(federal.ordinaryTaxableIncome)}</Td>
                    <Td numeric>{usd(federal.ordinaryTax)}</Td>
                  </TotalRow>
                </tbody>
              </Table>
            </TableWrap>
          </div>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Potential areas requiring professional review"
        description="Produced by the individual, deduction and compliance rule sets. Expand any row for the full chain from client fact to source."
        bodyClassName="p-0"
      >
        <FindingExplorer findings={relevant} rules={rules} />
      </Panel>

      <Panel className="mt-4" title="What this model does not do">
        <ul className="grid gap-1.5 md:grid-cols-2">
          {MODEL_LIMITATIONS.map((limitation) => (
            <li key={limitation} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-2">
              <span aria-hidden className="text-ink-4">
                —
              </span>
              <span>{limitation}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
