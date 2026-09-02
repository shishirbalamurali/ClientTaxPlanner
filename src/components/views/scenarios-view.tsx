import type { Client } from '@/lib/types';
import { ScenarioWorkbench } from '@/components/scenarios/scenario-workbench';
import { MetaItem, PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { MODEL_LIMITATIONS } from '@/lib/analysis/federal-model';
import { usd } from '@/lib/format';
import { getTaxYear } from '@/lib/tax-year';

export function ScenariosView({ client }: { client: Client }) {
const constants = getTaxYear(client.taxYear);

  return (
    <>
      <PageHeader
        eyebrow="Scenario analysis"
        title="Comparing four positions"
        summary="The current position against three single-lever alternatives. Each column is the same client record with one input changed, run through the same model, so a difference between columns can be attributed to the lever rather than to a change in method."
        meta={
          <>
            <MetaItem label="Client" value={client.displayName} />
            <MetaItem label="Tax year" value={constants.year} />
            <MetaItem label="Annual exclusion" value={usd(constants.wealthTransfer.annualGiftExclusion)} />
            <MetaItem
              label="Long-term gain on file"
              value={usd(client.income.longTermCapitalGain)}
            />
          </>
        }
      />

      <ScenarioWorkbench client={client} />

      <Panel className="mt-4" title="How to read this comparison">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="eyebrow mb-1.5">What the columns show</div>
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              Differences are modeled-year effects only. The gift planning column moves assets out of
              the estate but has no income tax effect in the modeled year; its value shows up in
              later years and at death. The capital gain timing column defers gain rather than
              eliminating it: the deferred amount is not taxed in a later year in this model, so the
              comparison overstates the benefit of deferral taken on its own.
            </p>
          </div>
          <div>
            <div className="eyebrow mb-1.5">What is excluded</div>
            <ul className="space-y-1">
              {MODEL_LIMITATIONS.map((limitation) => (
                <li key={limitation} className="flex gap-2 text-[12px] leading-snug text-ink-2">
                  <span aria-hidden className="text-ink-4">
                    —
                  </span>
                  <span>{limitation}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>
    </>
  );
}
