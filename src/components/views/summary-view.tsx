import type { Client } from '@/lib/types';
import { FormTag } from '@/components/ui/badge';
import { PrintButton } from '@/components/ui/print-button';
import { PageHeader, MetaItem } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Table, TableWrap, Td, Th } from '@/components/ui/table';
import { buildExecutiveSummary } from '@/lib/analysis/executive-summary';
import { formatDate } from '@/lib/format';
import { MODULE_LABELS, type FindingModule } from '@/lib/rules';
import { getTaxYear } from '@/lib/tax-year';

export function SummaryView({ client }: { client: Client }) {
const constants = getTaxYear(client.taxYear);
  const summary = buildExecutiveSummary(client, '2026-08-31');
  const { evaluation } = summary;

  return (
    <div className="mx-auto max-w-[900px]">
      <PageHeader
        eyebrow={`Executive summary · ${client.engagementRef}`}
        title={`${client.displayName} — ${constants.year} planning review`}
        summary="Prepared from the modeled client record for discussion with a qualified tax professional. Every item below is produced by a deterministic rule and traces to a government source in the research library."
        actions={<PrintButton label="Print memorandum" />}
        meta={
          <>
            <MetaItem label="Prepared" value={formatDate(summary.preparedOn)} />
            <MetaItem label="Tax year" value={constants.year} />
            <MetaItem label="Review items" value={summary.reviewAreas.length} />
            <MetaItem label="Forms implicated" value={summary.potentialForms.length} />
          </>
        }
      />

      <article className="space-y-4">
        {/* The standing notice lives in the app chrome, which does not print. */}
        <p className="hidden text-[11px] text-warn print:block">
          Educational model built on fictional client data. It does not provide tax, legal or
          financial advice and is not tax preparation software.
        </p>

        <Panel title="1. Client overview">
          <div className="space-y-3">
            {summary.overview.map((paragraph) => (
              <p key={paragraph} className="max-w-3xl text-[13px] leading-relaxed text-ink-2">
                {paragraph}
              </p>
            ))}
          </div>
        </Panel>

        <Panel title="2. Major financial characteristics" bodyClassName="p-0">
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th className="w-48">Characteristic</Th>
                  <Th className="w-44">Summary</Th>
                  <Th>Detail</Th>
                </tr>
              </thead>
              <tbody>
                {summary.characteristics.map((characteristic) => (
                  <tr key={characteristic.label}>
                    <Td className="font-medium text-ink">{characteristic.label}</Td>
                    <Td className="tnum font-semibold text-ink">{characteristic.value}</Td>
                    <Td className="text-ink-2">{characteristic.detail}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Panel>

        <Panel
          title="3. Identified review areas"
          description="Items the rule set raised for professional review on the modeled facts."
          bodyClassName="p-0"
        >
          {summary.reviewAreas.length === 0 ? (
            <p className="px-4 py-6 text-[12.5px] text-ink-3">
              No review items were raised on the modeled facts.
            </p>
          ) : (
            <ol>
              {summary.reviewAreas.map((area, index) => (
                <li key={area.ruleId + index} className="border-b border-rule px-4 py-3 last:border-b-0">
                  <div className="flex items-baseline gap-2.5">
                    <span className="tnum text-[11px] font-semibold text-ink-4">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold text-ink">{area.headline}</div>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">
                        {area.clientFact}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-ink-4">
                          {MODULE_LABELS[area.module as FindingModule]} · {area.ruleId}
                        </span>
                        {area.forms.map((form) => (
                          <FormTag key={form}>{form}</FormTag>
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        {summary.monitorAreas.length > 0 && (
          <Panel
            title="4. Items to monitor"
            description="Thresholds crossed that do not on their own indicate a separate filing."
            bodyClassName="p-0"
          >
            <ul>
              {summary.monitorAreas.map((area, index) => (
                <li
                  key={area.ruleId + index}
                  className="flex items-baseline justify-between gap-4 border-b border-rule px-4 py-2 last:border-b-0"
                >
                  <span className="text-[12.5px] text-ink-2">{area.headline}</span>
                  <span className="shrink-0 text-[11px] text-ink-4">{area.ruleId}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel
          title="5. Forms potentially implicated"
          description="Raised by one or more rules on the modeled facts. Whether a form is in fact required is a determination for the engagement team."
        >
          <div className="flex flex-wrap gap-1.5">
            {summary.potentialForms.map((form) => (
              <FormTag key={form}>{form}</FormTag>
            ))}
          </div>
        </Panel>

        <Panel
          title="6. Questions requiring professional review"
          description={`${summary.questions.length} open questions carried from the findings. These are the items that cannot be resolved from the client record as it stands.`}
        >
          <ol className="space-y-1.5">
            {summary.questions.map((question, index) => (
              <li key={question} className="flex gap-2.5 text-[12.5px] leading-relaxed text-ink-2">
                <span className="tnum shrink-0 text-[11px] font-semibold text-ink-4">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>{question}</span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="7. Basis of preparation and limitations">
          <div className="space-y-2.5 text-[12.5px] leading-relaxed text-ink-2">
            <p>
              This summary is an educational analytical product. It does not provide tax, legal or
              financial advice, does not constitute a covered opinion, and cannot be relied on to
              avoid penalties. It is not tax preparation software and produces no return.
            </p>
            <p>
              The client record is fictional and contains no taxpayer identification number, date of
              birth, address or account number. All figures are modeled amounts.
            </p>
            <p>
              Every threshold applied comes from the {constants.label} constants file, which cites
              its government source and records the date that source was last verified. Findings are
              produced by {evaluation.findings.length > 0 ? 'deterministic rules' : 'the rule set'} with
              stated predicates; no part of the flagging logic is generated at read time.
            </p>
            <p>
              The federal model is simplified. It does not compute alternative minimum tax, the
              qualified business income deduction, self-employment tax, credits, passive activity
              limitations or any state return. Where those matter, the rule set raises the item for
              review rather than estimating it.
            </p>
          </div>
        </Panel>
      </article>
    </div>
  );
}
