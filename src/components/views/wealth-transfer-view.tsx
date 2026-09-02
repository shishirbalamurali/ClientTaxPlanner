import type { Client } from '@/lib/types';
import { GroupedBarChart } from '@/components/charts/grouped-bar-chart';
import { FindingExplorer } from '@/components/findings/finding-explorer';
import { CitationList } from '@/components/ui/citation';
import { Tag } from '@/components/ui/badge';
import { Metric, MetricRow, StatLine } from '@/components/ui/metric';
import { MetaItem, PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Table, TableWrap, Td, Th, TotalRow } from '@/components/ui/table';
import { pct, usd, usdAccounting } from '@/lib/format';
import { GIFT_ASSET_LABELS } from '@/lib/labels';
import { evaluateClient, ruleMetaFor } from '@/lib/rules';
import { getTaxYear } from '@/lib/tax-year';

export function WealthTransferView({ client }: { client: Client }) {
const constants = getTaxYear(client.taxYear);
  const evaluation = evaluateClient(client, constants);
  const { gifts, findings } = evaluation;
  const rules = ruleMetaFor(findings);
  const relevant = findings.filter((finding) => finding.module === 'wealthTransfer');

  const chartData = gifts.donees.map((donee) => ({
    donee: donee.recipient.length > 22 ? `${donee.recipient.slice(0, 20)}…` : donee.recipient,
    excluded: Number.isFinite(donee.exclusionApplied) ? donee.exclusionApplied : donee.totalGifted,
    excess: donee.amountExceedingExclusion,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Wealth transfer"
        title="Form 709 gifting dashboard"
        summary={`Every transfer recorded for ${constants.year} is aggregated by donee and measured against the modeled annual exclusion. Exceeding the exclusion means a return is likely required — it does not mean gift tax is owed. Reportable amounts are applied against the lifetime basic exclusion amount first, and tax arises only once that amount is exhausted.`}
        meta={
          <>
            <MetaItem label="Annual exclusion" value={usd(gifts.annualExclusion)} />
            <MetaItem label="Non-citizen spouse exclusion" value={usd(gifts.noncitizenSpouseExclusion)} />
            <MetaItem label="Basic exclusion amount" value={usd(gifts.basicExclusionAmount)} />
            <MetaItem label="Donees" value={gifts.donees.length} />
          </>
        }
      />

      <MetricRow>
        <Metric label="Total transferred" value={usd(gifts.totalGifted)} note={`${client.gifts.length} transfers to ${gifts.donees.length} donees`} />
        <Metric label="Covered by annual exclusion" value={usd(gifts.totalExcluded)} tone="ok" />
        <Metric
          label="Above the exclusion"
          value={usd(gifts.totalExceedingExclusion)}
          tone={gifts.totalExceedingExclusion > 0 ? 'warn' : 'default'}
          note="Reportable against the lifetime exclusion"
        />
        <Metric
          label="Donees over the exclusion"
          value={`${gifts.doneesOverExclusion} of ${gifts.donees.length}`}
          tone={gifts.doneesOverExclusion > 0 ? 'flag' : 'ok'}
        />
      </MetricRow>

      <Panel
        className="mt-4"
        title="Transfers by donee"
        description={`Modeled annual exclusion applied per donee, with any amount above it shown separately. A gift-splitting election doubles the exclusion available for that donee to ${usd(gifts.annualExclusion * 2)}.`}
        bodyClassName="p-0"
        footnote={
          <CitationList
            ids={[
              'rp-2024-40-annual-gift-exclusion',
              'irc-2503-present-interest',
              'irs-i709-filing-requirement',
            ]}
          />
        }
      >
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Donee</Th>
                <Th>Relationship</Th>
                <Th>Asset</Th>
                <Th numeric>Gift amount</Th>
                <Th numeric>Modeled exclusion</Th>
                <Th numeric>Exclusion applied</Th>
                <Th numeric>Above exclusion</Th>
                <Th>Form 709 review</Th>
              </tr>
            </thead>
            <tbody>
              {gifts.donees.map((donee) => (
                <tr key={donee.recipient}>
                  <Td>
                    <span className="font-medium text-ink">{donee.recipient}</span>
                    {donee.gifts.length > 1 && (
                      <div className="text-[11.5px] text-ink-4">
                        {donee.gifts.length} separate transfers
                      </div>
                    )}
                  </Td>
                  <Td className="text-ink-3">{donee.relationship}</Td>
                  <Td className="text-ink-3">
                    {[...new Set(donee.gifts.map((gift) => GIFT_ASSET_LABELS[gift.assetType]))].join(
                      ', ',
                    )}
                  </Td>
                  <Td numeric>{usd(donee.totalGifted)}</Td>
                  <Td numeric>
                    {Number.isFinite(donee.modeledExclusion)
                      ? usd(donee.modeledExclusion * (donee.splitElectionApplies ? 2 : 1))
                      : 'Unlimited'}
                  </Td>
                  <Td numeric>
                    {Number.isFinite(donee.exclusionApplied) ? usd(donee.exclusionApplied) : '—'}
                  </Td>
                  <Td numeric className={donee.amountExceedingExclusion > 0 ? 'font-semibold text-flag' : undefined}>
                    {usdAccounting(donee.amountExceedingExclusion)}
                  </Td>
                  <Td>
                    {donee.requiresFormReview ? (
                      <span className="inline-block rounded-[2px] border border-flag/30 bg-flag-wash px-1.5 py-px text-[10.5px] font-semibold text-flag">
                        Indicated
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-ink-4">Not indicated</span>
                    )}
                    {donee.reviewReasons.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {donee.reviewReasons.map((reason) => (
                          <li key={reason} className="text-[11px] leading-snug text-ink-3">
                            {reason}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Td>
                </tr>
              ))}
              <TotalRow>
                <Td colSpan={3}>Total</Td>
                <Td numeric>{usd(gifts.totalGifted)}</Td>
                <Td numeric>—</Td>
                <Td numeric>{usd(gifts.totalExcluded)}</Td>
                <Td numeric>{usd(gifts.totalExceedingExclusion)}</Td>
                <Td />
              </TotalRow>
            </tbody>
          </Table>
        </TableWrap>
      </Panel>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Panel
          title="Exclusion coverage by donee"
          description="The lower segment is covered by the annual exclusion; the upper segment is reportable against the lifetime exclusion."
        >
          <GroupedBarChart
            data={chartData}
            categoryKey="donee"
            height={250}
            series={[
              { key: 'excluded', label: 'Covered by annual exclusion', stackId: 'gift' },
              { key: 'excess', label: 'Above the annual exclusion', stackId: 'gift' },
            ]}
          />
        </Panel>

        <Panel
          title="Lifetime exclusion"
          description="Current year reportable gifts added to amounts reported in prior years."
          footnote={<CitationList ids={['rp-2024-40-basic-exclusion', 'irc-2010-unified-credit']} />}
        >
          <StatLine label={`Basic exclusion amount, ${constants.year}`} value={usd(gifts.basicExclusionAmount)} />
          <StatLine label="Reported as used before this year" value={usdAccounting(-gifts.lifetimeExclusionPreviouslyUsed)} indent />
          <StatLine label="Modeled current year taxable gifts" value={usdAccounting(-gifts.totalExceedingExclusion)} indent />
          <StatLine label="Projected remaining exclusion" value={usd(gifts.remainingExclusion)} emphasis />

          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Exclusion used</span>
              <span className="tnum text-[12.5px] font-semibold text-ink">
                {pct(gifts.exclusionUtilization)}
              </span>
            </div>
            <div
              className="mt-1.5 h-2 w-full border border-rule-strong bg-canvas-2"
              role="img"
              aria-label={`${pct(gifts.exclusionUtilization)} of the basic exclusion amount projected as used`}
            >
              <div
                className="h-full bg-accent"
                style={{ width: `${Math.min(100, gifts.exclusionUtilization * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
              The credit is unified: exclusion consumed on lifetime gifts is not available again at
              death. Prior year figures come from the client record and should be reconciled to the
              filed returns before any planning is committed.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-rule pt-3">
            {gifts.anySplitElection && <Tag>Gift-splitting election indicated</Tag>}
            {gifts.anyFutureInterestGift && <Tag>Future interest transfer present</Tag>}
            {!client.spouseIsUSCitizen && <Tag>Non-citizen spouse</Tag>}
            {gifts.formReviewIndicated ? <Tag>Form 709 review indicated</Tag> : <Tag>No return indicated</Tag>}
          </div>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Wealth transfer review items"
        bodyClassName="p-0"
        footnote={
          <>
            A Form 709 filing requirement is a reporting question, not a payment question. Gift tax
            becomes payable only when cumulative taxable gifts exceed the basic exclusion amount, and
            several exclusions not modeled here — direct payments of tuition and medical expenses
            under § 2503(e) among them — can remove a transfer from the calculation entirely.
          </>
        }
      >
        <FindingExplorer
          findings={relevant}
          rules={rules}
          showModule={false}
          emptyMessage="No wealth transfer review items were raised on the modeled facts."
        />
      </Panel>
    </>
  );
}
