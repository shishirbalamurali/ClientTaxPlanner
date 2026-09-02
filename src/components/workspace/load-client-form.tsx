'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Panel } from '@/components/ui/panel';
import { PageHeader } from '@/components/ui/page-header';
import { EXAMPLE_CLIENT_JSON, parseClientInput } from '@/lib/client-input';
import { saveWorkspaceClient } from '@/lib/workspace-store';
import { SAMPLE_CLIENTS } from '@/data/clients';

const FIELD_REFERENCE: Array<[string, string]> = [
  ['displayName', 'Any label. Never a real name.'],
  ['filingStatus', 'single · marriedFilingJointly · marriedFilingSeparately · headOfHousehold · qualifyingSurvivingSpouse'],
  ['residency', 'stateCode, stateName, topMarginalStateRate, livesAbroad'],
  ['income', 'wages, bonus, equityCompensation, taxableInterest, taxExemptInterest, qualifiedDividends, nonQualifiedDividends, shortTermCapitalGain, longTermCapitalGain, businessIncome, rentalIncome, trustDistributions, retirementDistributions, otherIncome'],
  ['deductions', 'charitableCash, charitableAppreciatedSecurities, charitablePrivateFoundation, stateAndLocalTaxesPaid, mortgageInterest, medicalExpenses, investmentInterestExpense, charitableCarryforward'],
  ['gifts[]', 'recipient (required), amount, relationship, assetType, intoTrust, crummeyWithdrawalRight, spouseElectsGiftSplitting, recipientIsSpouse, recipientIsUSCitizen, costBasis'],
  ['foreignAccounts[]', 'institution, country, maximumValueUSD, yearEndValueUSD, accountType, interestType, isEmployerPlan'],
  ['trusts[]', 'name, kind, situs, principalValue, income{interest,dividends,capitalGains,rental,other}, distributionsToBeneficiaries, capitalGainsAllocatedToIncome, hasNonresidentAlienBeneficiary, isForeignTrust'],
  ['priorYearAdjustedGrossIncome', 'Drives the estimated tax safe harbor.'],
  ['lifetimeExclusionPreviouslyUsed', 'Gift exclusion reported as used in prior years.'],
];

export function LoadClientForm() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const analyze = () => {
    const result = parseClientInput(text);
    if (!result.ok) {
      setErrors(result.errors);
      setWarnings([]);
      return;
    }
    setErrors([]);
    setWarnings(result.warnings);
    saveWorkspaceClient(result.client);
    router.push('/workspace/dashboard');
  };

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8">
      <PageHeader
        eyebrow="Workspace"
        title="Load a client record"
        summary="Paste a record below and every module in the simulator will run on it. The record is read and analysed entirely inside your browser: nothing is uploaded, nothing is stored on a server, and it is discarded when you close this tab."
      />

      <div className="mb-4 border border-warn/30 bg-warn-wash px-4 py-3">
        <div className="text-[12.5px] font-semibold text-warn">
          Do not paste real client information
        </div>
        <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-ink-2">
          Although nothing leaves your browser, this is a portfolio demonstration and not an
          approved system for handling client data. Use invented figures. The model has no field
          for a taxpayer identification number, date of birth, address or account number, and none
          should ever be entered.
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Panel
          title="Client record"
          description="JSON. Anything you leave out takes a sensible default, so a useful record can be a few lines."
          actions={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setText(EXAMPLE_CLIENT_JSON);
                  setErrors([]);
                  setWarnings([]);
                }}
                className="rounded-[3px] border border-rule-strong bg-canvas px-2.5 py-1 text-[11.5px] text-ink-3 hover:border-ink-4 hover:text-ink"
              >
                Load an example
              </button>
              <button
                type="button"
                onClick={() => {
                  setText('');
                  setErrors([]);
                  setWarnings([]);
                }}
                className="rounded-[3px] border border-rule-strong bg-canvas px-2.5 py-1 text-[11.5px] text-ink-3 hover:border-ink-4 hover:text-ink"
              >
                Clear
              </button>
            </div>
          }
        >
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            rows={22}
            placeholder={'{\n  "displayName": "Test client",\n  "filingStatus": "single",\n  "income": { "wages": 900000 }\n}'}
            className="tnum w-full resize-y rounded-[3px] border border-rule-strong bg-canvas p-3 font-mono text-[12px] leading-relaxed text-ink placeholder:text-ink-4 focus:border-accent-2"
          />

          {errors.length > 0 && (
            <div className="mt-3 border border-flag/30 bg-flag-wash px-3 py-2.5">
              <div className="text-[12px] font-semibold text-flag">
                {errors.length === 1 ? 'One problem to fix' : `${errors.length} problems to fix`}
              </div>
              <ul className="mt-1.5 space-y-1">
                {errors.map((message) => (
                  <li key={message} className="font-mono text-[11.5px] leading-relaxed text-ink-2">
                    {message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {warnings.length > 0 && errors.length === 0 && (
            <div className="mt-3 border border-warn/30 bg-warn-wash px-3 py-2.5">
              <div className="text-[12px] font-semibold text-warn">Loaded, with assumptions</div>
              <ul className="mt-1.5 space-y-1">
                {warnings.map((message) => (
                  <li key={message} className="text-[11.5px] leading-relaxed text-ink-2">
                    {message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-rule pt-3">
            <p className="text-[11.5px] text-ink-4">
              Nothing is transmitted. The analysis runs on this page.
            </p>
            <button
              type="button"
              onClick={analyze}
              className="rounded-[3px] border border-accent bg-accent px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-accent-2"
            >
              Analyse this record
            </button>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Fields the model reads" bodyClassName="p-0">
            <dl className="divide-y divide-rule">
              {FIELD_REFERENCE.map(([field, detail]) => (
                <div key={field} className="px-4 py-2">
                  <dt className="font-mono text-[11.5px] font-semibold text-ink">{field}</dt>
                  <dd className="mt-0.5 text-[11.5px] leading-relaxed text-ink-3">{detail}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Or start from a sample client">
            <p className="text-[12.5px] leading-relaxed text-ink-3">
              The three records that ship with the project are already loaded and need no pasting.
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {SAMPLE_CLIENTS.map((client) => (
                <li key={client.id}>
                  <Link
                    href={`/clients/${client.id}/dashboard`}
                    className="text-[12.5px] text-accent-2 underline decoration-rule-strong underline-offset-2 hover:decoration-accent-2"
                  >
                    {client.displayName}
                  </Link>
                  <span className="text-[11.5px] text-ink-4"> · {client.archetypeLabel}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
