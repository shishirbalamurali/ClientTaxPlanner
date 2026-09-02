import type { Client } from '@/lib/types';
import { CompositionChart } from '@/components/charts/composition-chart';
import { FindingExplorer } from '@/components/findings/finding-explorer';
import { Tag } from '@/components/ui/badge';
import { CitationList } from '@/components/ui/citation';
import { Metric, MetricRow, StatLine } from '@/components/ui/metric';
import { MetaItem, PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Table, TableWrap, Td, Th, TotalRow } from '@/components/ui/table';
import { pct, usd } from '@/lib/format';
import {
  FOREIGN_ACCOUNT_TYPE_LABELS,
  FOREIGN_ENTITY_LABELS,
  FOREIGN_INTEREST_LABELS,
} from '@/lib/labels';
import { evaluateClient, ruleMetaFor } from '@/lib/rules';
import { getTaxYear } from '@/lib/tax-year';

export function ForeignAccountsView({ client }: { client: Client }) {
const constants = getTaxYear(client.taxYear);
  const evaluation = evaluateClient(client, constants);
  const { foreign, findings } = evaluation;
  const rules = ruleMetaFor(findings);
  const relevant = findings.filter((finding) => finding.module === 'foreign');

  const headroomText = foreign.fbarReviewFlag
    ? `${usd(foreign.aggregateMaximumValue - foreign.fbarThreshold)} above the threshold`
    : `${usd(Math.max(0, foreign.fbarHeadroom))} below the threshold`;

  return (
    <>
      <PageHeader
        eyebrow="Foreign accounts"
        title="FBAR and foreign asset reporting"
        summary="The FBAR test is applied to the aggregate maximum value of every reportable account rather than account by account, so an account far below the threshold is still reported once the aggregate is exceeded. Form 8938 is measured separately, on a different base and against different thresholds; the same account is commonly reported on both."
        meta={
          <>
            <MetaItem label="Accounts" value={foreign.accountCount} />
            <MetaItem label="Countries" value={foreign.countries.length} />
            <MetaItem label="FBAR threshold" value={usd(foreign.fbarThreshold)} />
            <MetaItem
              label="Residence basis"
              value={foreign.form8938Basis === 'livingAbroad' ? 'Living abroad' : 'Living in the U.S.'}
            />
          </>
        }
      />

      <MetricRow>
        <Metric
          label="Aggregate maximum value"
          value={foreign.accountCount === 0 ? '—' : usd(foreign.aggregateMaximumValue)}
          tone={foreign.fbarReviewFlag ? 'flag' : 'ok'}
          note={foreign.accountCount === 0 ? 'No accounts recorded' : headroomText}
        />
        <Metric
          label="FBAR review flag"
          value={foreign.fbarReviewFlag ? 'Raised' : 'Not raised'}
          tone={foreign.fbarReviewFlag ? 'flag' : 'ok'}
          note={`Aggregate maximum against a ${usd(foreign.fbarThreshold)} threshold`}
        />
        <Metric
          label="Form 8938 review flag"
          value={foreign.form8938ReviewFlag ? 'Raised' : 'Not raised'}
          tone={foreign.form8938ReviewFlag ? 'flag' : 'ok'}
          note={`${usd(foreign.form8938YearEndThreshold)} at year end / ${usd(foreign.form8938AnyTimeThreshold)} at any time`}
        />
        <Metric
          label="Year-end aggregate"
          value={foreign.accountCount === 0 ? '—' : usd(foreign.aggregateYearEndValue)}
          note={`Largest single account ${usd(foreign.largestAccountValue)}`}
        />
      </MetricRow>

      {foreign.accountCount === 0 ? (
        <Panel className="mt-4" title="No foreign financial accounts recorded">
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            The client record shows no foreign financial accounts, so neither the FBAR aggregate test
            nor the Form 8938 thresholds are met. The absence of a flag reflects the absence of
            recorded accounts; it is not an assurance that no account exists. Accounts held only
            under signature authority, foreign pensions and non-U.S. insurance products are commonly
            omitted from a client’s own account listing.
          </p>
          <div className="mt-3">
            <CitationList ids={['fincen-114-threshold', 'form-8938-thresholds']} />
          </div>
        </Panel>
      ) : (
        <>
          <Panel
            className="mt-4"
            title="Foreign financial accounts"
            description="Maximum value during the calendar year, converted to U.S. dollars."
            bodyClassName="p-0"
            footnote={<CitationList ids={['fincen-114-threshold', 'irs-fbar-overview']} />}
          >
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Institution</Th>
                    <Th>Country</Th>
                    <Th>Account type</Th>
                    <Th>Interest</Th>
                    <Th>Currency</Th>
                    <Th numeric>Maximum value</Th>
                    <Th numeric>Year-end value</Th>
                    <Th numeric>Share of aggregate</Th>
                  </tr>
                </thead>
                <tbody>
                  {foreign.accounts.map((account) => (
                    <tr key={account.id}>
                      <Td>
                        <span className="font-medium text-ink">{account.institution}</span>
                        {(account.isEmployerPlan || account.accountType === 'pension') && (
                          <div className="mt-1">
                            <Tag>Employer plan</Tag>
                          </div>
                        )}
                      </Td>
                      <Td className="text-ink-3">{account.country}</Td>
                      <Td className="text-ink-3">
                        {FOREIGN_ACCOUNT_TYPE_LABELS[account.accountType]}
                      </Td>
                      <Td className="text-ink-3">
                        {FOREIGN_INTEREST_LABELS[account.interestType]}
                      </Td>
                      <Td className="tnum text-ink-3">{account.localCurrency}</Td>
                      <Td numeric>{usd(account.maximumValueUSD)}</Td>
                      <Td numeric>{usd(account.yearEndValueUSD)}</Td>
                      <Td numeric>
                        {pct(account.maximumValueUSD / foreign.aggregateMaximumValue)}
                      </Td>
                    </tr>
                  ))}
                  <TotalRow>
                    <Td colSpan={5}>Aggregate maximum value</Td>
                    <Td numeric>{usd(foreign.aggregateMaximumValue)}</Td>
                    <Td numeric>{usd(foreign.aggregateYearEndValue)}</Td>
                    <Td numeric>100.0%</Td>
                  </TotalRow>
                </tbody>
              </Table>
            </TableWrap>
          </Panel>

          <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Panel title="Exposure by country" description="Aggregate maximum value by jurisdiction.">
              <CompositionChart
                data={foreign.countries.map((country) => ({
                  label: country.country,
                  value: country.maximumValueUSD,
                }))}
              />
            </Panel>

            <Panel
              title="Threshold tests"
              description="Each test is applied mechanically to the recorded values."
              footnote={<CitationList ids={['form-8938-thresholds', 'fincen-114-threshold']} />}
            >
              <div className="eyebrow mb-1.5">FBAR — FinCEN Form 114</div>
              <StatLine label="Aggregate maximum value, all accounts" value={usd(foreign.aggregateMaximumValue)} />
              <StatLine label="Excluding signature-authority-only accounts" value={usd(foreign.aggregateMaximumExcludingSignatureAuthority)} indent />
              <StatLine label="Threshold" value={usd(foreign.fbarThreshold)} />
              <StatLine
                label="Result"
                value={foreign.fbarReviewFlag ? 'Review indicated' : 'Below threshold'}
                emphasis
              />

              <div className="eyebrow mt-4 mb-1.5">Form 8938 — specified foreign financial assets</div>
              <StatLine label="Year-end aggregate" value={usd(foreign.aggregateYearEndValue)} />
              <StatLine label="Year-end threshold" value={usd(foreign.form8938YearEndThreshold)} indent />
              <StatLine label="Maximum during the year" value={usd(foreign.aggregateMaximumValue)} />
              <StatLine label="Any-time threshold" value={usd(foreign.form8938AnyTimeThreshold)} indent />
              <StatLine
                label="Result"
                value={foreign.form8938ReviewFlag ? 'Review indicated' : 'Below thresholds'}
                emphasis
              />

              <p className="mt-3 border-t border-rule pt-3 text-[11.5px] leading-relaxed text-ink-3">
                Signature authority alone creates an FBAR obligation but generally falls outside Form
                8938, which is why the two aggregates differ. The model counts recorded accounts
                only; foreign non-account assets such as directly held foreign stock also count
                toward the Form 8938 threshold.
              </p>
            </Panel>
          </div>
        </>
      )}

      {client.foreignEntities.length > 0 && (
        <Panel
          className="mt-4"
          title="Foreign entity interests"
          bodyClassName="p-0"
          footnote={<CitationList ids={['irs-i5471-foreign-corporation', 'irs-i8621-pfic', 'irs-i3520-foreign-trust-gift']} />}
        >
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Entity</Th>
                  <Th>Country</Th>
                  <Th>Kind</Th>
                  <Th numeric>Ownership</Th>
                  <Th numeric>Value</Th>
                  <Th>Note</Th>
                </tr>
              </thead>
              <tbody>
                {client.foreignEntities.map((entity) => (
                  <tr key={entity.id}>
                    <Td className="font-medium text-ink">{entity.name}</Td>
                    <Td className="text-ink-3">{entity.country}</Td>
                    <Td className="text-ink-3">{FOREIGN_ENTITY_LABELS[entity.kind]}</Td>
                    <Td numeric>{pct(entity.ownershipPercent, 2)}</Td>
                    <Td numeric>{usd(entity.valueUSD)}</Td>
                    <Td className="max-w-xs text-[11.5px] text-ink-3">{entity.note ?? '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Panel>
      )}

      <Panel
        className="mt-4"
        title="Foreign reporting review items"
        bodyClassName="p-0"
        footnote={
          <>
            Foreign information reporting penalties are assessed on a per-form, per-year basis and do
            not depend on whether tax is owed. Where a flag is raised, the sequence of questions
            matters: establish whether the obligation exists, then whether prior years were filed,
            then which correction procedure applies.
          </>
        }
      >
        <FindingExplorer
          findings={relevant}
          rules={rules}
          showModule={false}
          emptyMessage="No foreign reporting review items were raised on the modeled facts."
        />
      </Panel>
    </>
  );
}
