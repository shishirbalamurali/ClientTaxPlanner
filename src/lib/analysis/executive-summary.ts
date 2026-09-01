import { compactUsd, pct, plural, usd } from '@/lib/format';
import { FILING_STATUS_LABELS } from '@/lib/labels';
import { evaluateClient, type ClientEvaluation } from '@/lib/rules';
import { getTaxYear } from '@/lib/tax-year';
import type { Client } from '@/lib/types';

export interface SummaryCharacteristic {
  label: string;
  value: string;
  detail: string;
}

export interface ReviewArea {
  module: string;
  headline: string;
  clientFact: string;
  forms: string[];
  ruleId: string;
}

export interface ExecutiveSummary {
  client: Client;
  evaluation: ClientEvaluation;
  overview: string[];
  netWorth: number;
  characteristics: SummaryCharacteristic[];
  reviewAreas: ReviewArea[];
  monitorAreas: ReviewArea[];
  potentialForms: string[];
  questions: string[];
  preparedOn: string;
}

export function computeNetWorth(client: Client): number {
  const bs = client.balanceSheet;
  const realEstateEquity = bs.realEstate.reduce(
    (sum, holding) => sum + holding.marketValue - holding.mortgageBalance,
    0,
  );
  const concentrated = bs.concentratedPositions.reduce((sum, p) => sum + p.marketValue, 0);
  const trustPrincipal = client.trusts
    .filter((trust) => trust.kind === 'grantorRevocable')
    .reduce((sum, trust) => sum + trust.principalValue, 0);
  return (
    bs.cashAndEquivalents +
    bs.marketablePortfolio +
    concentrated +
    bs.privateBusinessInterests +
    bs.retirementAccounts +
    realEstateEquity +
    trustPrincipal -
    bs.otherLiabilities
  );
}

/**
 * Assembles the client-facing deliverable. Every sentence here is composed from
 * values the rule engine already produced; nothing is generated at read time.
 */
export function buildExecutiveSummary(
  client: Client,
  preparedOn: string = new Date().toISOString().slice(0, 10),
): ExecutiveSummary {
  const constants = getTaxYear(client.taxYear);
  const evaluation = evaluateClient(client, constants);
  const { federal, gifts, trusts, foreign } = evaluation;
  const netWorth = computeNetWorth(client);

  const dependents = client.dependents.length;
  const overview = [
    `${client.displayName} is a ${client.age}-year-old ${client.archetypeLabel.toLowerCase()} filing ${FILING_STATUS_LABELS[client.filingStatus].toLowerCase()}${client.spouseName ? ` with ${client.spouseName}` : ''}${dependents > 0 ? ` and ${dependents} dependent${dependents === 1 ? '' : 's'}` : ''}. ${client.residency.residencyNote}`,
    `Modeled ${constants.year} income is ${usd(federal.income.totalModeledIncome)}, of which ${pct(federal.income.investmentIncome / Math.max(1, federal.income.totalModeledIncome))} is investment income. Modeled net worth, including revocable trust assets, is approximately ${compactUsd(netWorth)}.`,
    `The engagement file records ${client.gifts.length} transfer${client.gifts.length === 1 ? '' : 's'} to ${gifts.donees.length} donee${gifts.donees.length === 1 ? '' : 's'}, ${client.trusts.length} trust${client.trusts.length === 1 ? '' : 's'} and ${foreign.accountCount} foreign financial account${foreign.accountCount === 1 ? '' : 's'}.`,
  ];

  const characteristics: SummaryCharacteristic[] = [
    {
      label: 'Income composition',
      value: `${pct(federal.income.earnedIncome / Math.max(1, federal.income.totalModeledIncome))} earned`,
      detail: `${usd(federal.income.earnedIncome)} of employment income against ${usd(federal.income.investmentIncome)} of investment income and ${usd(client.income.businessIncome)} of pass-through business income.`,
    },
    {
      label: 'Marginal position',
      value: `${pct(federal.marginalOrdinaryRate)} ordinary`,
      detail: `Modeled taxable income of ${usd(federal.taxableIncome)} produces a ${pct(federal.effectiveRateOnModeledIncome)} effective federal rate on total modeled income.`,
    },
    {
      label: 'Deduction posture',
      value: federal.deductionMethod === 'itemized' ? 'Itemizing' : 'Standard deduction',
      detail: `${usd(federal.deductionTaken)} taken. State and local taxes are limited to ${usd(federal.salt.cap)} of the ${usd(federal.salt.paid)} paid. Charitable contributions of ${usd(federal.charitable.totalContributed)} are ${
        federal.charitable.disallowedCarryforward > 0
          ? `deductible to ${usd(federal.charitable.totalAllowed)}, with ${usd(federal.charitable.disallowedCarryforward)} carried forward`
          : 'currently deductible in full'
      }.`,
    },
    {
      label: 'Transfers during the year',
      value: usd(gifts.totalGifted),
      detail: `${usd(gifts.totalExcluded)} covered by the modeled annual exclusions, ${usd(gifts.totalExceedingExclusion)} reportable against the lifetime exclusion. ${pct(gifts.exclusionUtilization)} of the ${usd(gifts.basicExclusionAmount)} basic exclusion amount is projected as used.`,
    },
    {
      label: 'Fiduciary position',
      value: `${client.trusts.length} trust${client.trusts.length === 1 ? '' : 's'}`,
      detail:
        client.trusts.length === 0
          ? 'No trusts on file.'
          : `${usd(trusts.totalGrossIncome)} of trust income with ${usd(trusts.totalDistributions)} distributed and ${usd(trusts.totalRetainedIncome)} retained across ${trusts.nonGrantorTrustCount} non-grantor ${plural(trusts.nonGrantorTrustCount, 'trust')} and ${trusts.grantorTrustCount} grantor ${plural(trusts.grantorTrustCount, 'trust')}.`,
    },
    {
      label: 'Foreign exposure',
      value: foreign.accountCount === 0 ? 'None recorded' : compactUsd(foreign.aggregateMaximumValue),
      detail:
        foreign.accountCount === 0
          ? 'No foreign financial accounts or foreign entity interests are recorded on the client file.'
          : `Aggregate maximum value of ${usd(foreign.aggregateMaximumValue)} across ${foreign.accountCount} ${plural(foreign.accountCount, 'account')} in ${foreign.countries.length} ${plural(foreign.countries.length, 'country', 'countries')}, against a ${usd(foreign.fbarThreshold)} FBAR aggregate threshold.`,
    },
  ];

  const toArea = (finding: (typeof evaluation.findings)[number]): ReviewArea => ({
    module: finding.module,
    headline: finding.headline,
    clientFact: finding.clientFact,
    forms: finding.potentialForms,
    ruleId: finding.ruleId,
  });

  const questions = [
    ...new Set(evaluation.findings.flatMap((finding) => finding.questionsForReview)),
  ];

  return {
    client,
    evaluation,
    overview,
    netWorth,
    characteristics,
    reviewAreas: evaluation.findings.filter((f) => f.severity === 'review').map(toArea),
    monitorAreas: evaluation.findings.filter((f) => f.severity === 'monitor').map(toArea),
    potentialForms: evaluation.potentialForms,
    questions,
    preparedOn,
  };
}
