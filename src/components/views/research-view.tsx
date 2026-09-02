import type { Client } from '@/lib/types';
import { FindingExplorer } from '@/components/findings/finding-explorer';
import { AuthorityBrowser } from '@/components/research/authority-browser';
import { RuleCatalogTable } from '@/components/research/rule-catalog-table';
import { Metric, MetricRow } from '@/components/ui/metric';
import { MetaItem, PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Table, TableWrap, Td, Th } from '@/components/ui/table';
import { formatDate, usd } from '@/lib/format';
import { AUTHORITIES } from '@/lib/research/authorities';
import { RULE_CATALOG, evaluateClient, ruleMetaFor } from '@/lib/rules';
import { getTaxYear } from '@/lib/tax-year';

export function ResearchView({ client }: { client: Client }) {
const constants = getTaxYear(client.taxYear);
  const evaluation = evaluateClient(client, constants);
  const rules = ruleMetaFor(evaluation.findings);
  const firedRuleIds = [...new Set(evaluation.findings.map((finding) => finding.ruleId))];

  const oldestVerification = AUTHORITIES.reduce(
    (oldest, authority) => (authority.lastVerified < oldest ? authority.lastVerified : oldest),
    AUTHORITIES[0]!.lastVerified,
  );

  const constantRows: Array<[string, string, string]> = [
    ['Annual gift exclusion', usd(constants.wealthTransfer.annualGiftExclusion), constants.sourceKeys.annualGiftExclusion],
    ['Non-citizen spouse exclusion', usd(constants.wealthTransfer.noncitizenSpouseAnnualExclusion), constants.sourceKeys.annualGiftExclusion],
    ['Basic exclusion amount', usd(constants.wealthTransfer.basicExclusionAmount), constants.sourceKeys.basicExclusionAmount],
    ['FBAR aggregate threshold', usd(constants.foreignReporting.fbarAggregateThreshold), constants.sourceKeys.fbarThreshold],
    [
      'Form 8938 threshold (this client)',
      `${usd(constants.foreignReporting.form8938[client.residency.livesAbroad ? 'livingAbroad' : 'livingInUS'][client.filingStatus].yearEnd)} year end`,
      constants.sourceKeys.form8938Thresholds,
    ],
    ['Standard deduction', usd(constants.standardDeduction[client.filingStatus]), constants.sourceKeys.standardDeduction],
    ['State and local tax cap', usd(constants.saltLimitation.cap[client.filingStatus]), constants.sourceKeys.saltLimitation],
    ['Net investment income tax threshold', usd(constants.netInvestmentIncomeTax.thresholds[client.filingStatus]), constants.sourceKeys.netInvestmentIncomeTax],
    ['Additional Medicare tax threshold', usd(constants.additionalMedicareTax.thresholds[client.filingStatus]), constants.sourceKeys.additionalMedicareTax],
    ['Top fiduciary bracket begins', usd(constants.fiduciary.netInvestmentIncomeThreshold), constants.sourceKeys.fiduciaryRates],
    ['Form 1041 gross income filing threshold', usd(constants.fiduciary.grossIncomeFilingThreshold), constants.sourceKeys.fiduciaryRates],
    ['Section 199A threshold amount', usd(constants.qualifiedBusinessIncome.thresholdAmount[client.filingStatus]), constants.sourceKeys.qualifiedBusinessIncome],
    ['AMT exemption', usd(constants.alternativeMinimumTax.exemption[client.filingStatus]), constants.sourceKeys.alternativeMinimumTax],
    ['Estimated tax safe harbor (prior year AGI above $150,000)', `${constants.estimatedTax.highIncomeSafeHarborRate * 100}%`, constants.sourceKeys.estimatedTaxSafeHarbor],
  ];

  const authorityById = new Map(AUTHORITIES.map((authority) => [authority.id, authority]));

  return (
    <>
      <PageHeader
        eyebrow="Research library"
        title="Rules, sources and flag tracing"
        summary="Every threshold the application applies is recorded here with the government source it came from and the date that source was last checked. No flag in this application is produced by a language model: each one comes from a deterministic rule with a stated predicate, listed below."
        meta={
          <>
            <MetaItem label="Authorities" value={AUTHORITIES.length} />
            <MetaItem label="Rules" value={RULE_CATALOG.length} />
            <MetaItem label="Fired for this client" value={firedRuleIds.length} />
            <MetaItem label="Oldest verification" value={formatDate(oldestVerification)} />
          </>
        }
      />

      <MetricRow>
        <Metric label="Modeled tax year" value={String(constants.year)} note={constants.label} />
        <Metric label="Findings for this client" value={String(evaluation.findings.length)} note={`${evaluation.reviewCount} review, ${evaluation.monitorCount} monitor, ${evaluation.informationalCount} informational`} />
        <Metric label="Forms implicated" value={String(evaluation.potentialForms.length)} />
        <Metric label="Sources cited" value={String(new Set(evaluation.findings.flatMap((f) => f.authorityIds)).size)} note="Distinct authorities behind this client's findings" />
      </MetricRow>

      <Panel
        className="mt-4"
        title="Why was this flagged?"
        description="Each finding traces from the client fact, through the rule that measured it, to the analysis, the form potentially implicated and the government source. Expand a row to see the full chain."
        bodyClassName="p-0"
      >
        <FindingExplorer findings={evaluation.findings} rules={rules} />
      </Panel>

      <Panel
        className="mt-4"
        title="Rule set"
        description="The complete deterministic rule set, with the predicate each rule evaluates and the authorities it relies on."
        bodyClassName="p-0"
      >
        <RuleCatalogTable rules={RULE_CATALOG} firedRuleIds={firedRuleIds} />
      </Panel>

      <Panel
        className="mt-4"
        title={`Modeled constants — ${constants.year}`}
        description="Values applied to this client, resolved by filing status and residence. Change the tax year data file to model a different year; nothing here is hard-coded in the rules."
        bodyClassName="p-0"
      >
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Constant</Th>
                <Th numeric>Value</Th>
                <Th>Citation</Th>
                <Th>Source</Th>
                <Th>Last verified</Th>
              </tr>
            </thead>
            <tbody>
              {constantRows.map(([label, value, sourceKey]) => {
                const authority = authorityById.get(sourceKey);
                return (
                  <tr key={label}>
                    <Td>{label}</Td>
                    <Td numeric className="font-semibold text-ink">
                      {value}
                    </Td>
                    <Td>
                      {authority && (
                        <a
                          href={authority.sourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-accent-2 underline decoration-rule-strong underline-offset-2 hover:decoration-accent-2"
                        >
                          {authority.citation}
                        </a>
                      )}
                    </Td>
                    <Td className="text-ink-3">{authority?.governmentSource}</Td>
                    <Td className="tnum text-ink-3">
                      {authority ? formatDate(authority.lastVerified) : '—'}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      </Panel>

      <Panel
        className="mt-4"
        title="Source library"
        description="Statutes, regulations, revenue procedures, form instructions and publications relied on anywhere in the application."
        bodyClassName="p-0"
        footnote={
          <>
            Verification dates record when the URL resolved and the quoted amounts were re-read
            against the source. Re-check before relying on any entry for a live engagement; amounts
            are adjusted annually and legislation can supersede a published figure mid-year, as it
            did for the 2025 standard deduction and state and local tax cap.
          </>
        }
      >
        <AuthorityBrowser taxYear={constants.year} />
      </Panel>
    </>
  );
}
