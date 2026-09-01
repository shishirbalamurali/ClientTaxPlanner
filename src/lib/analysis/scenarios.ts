import { analyzeGifts, type GiftAnalysis } from './gifts';
import { runFederalModel, type FederalModelResult } from './federal-model';
import type { TaxYearConstants } from '@/lib/tax-year';
import type { Client, Gift } from '@/lib/types';

export type ScenarioKey = 'current' | 'giftPlanning' | 'charitableGiving' | 'capitalGainTiming';

export interface ScenarioParameters {
  /** Elect § 2513 gift splitting on present-interest gifts to non-spouse donees. */
  electGiftSplitting: boolean;
  /** Top existing donees up to the full modeled annual exclusion. */
  topUpDoneesToExclusion: boolean;
  /** Additional donees brought into the plan at the full annual exclusion. */
  additionalDonees: number;
  /** Incremental contribution of appreciated securities to a public charity. */
  incrementalAppreciatedGift: number;
  /** Share of long-term capital gain deferred out of the modeled year. */
  capitalGainDeferralShare: number;
}

export const DEFAULT_SCENARIO_PARAMETERS: ScenarioParameters = {
  electGiftSplitting: true,
  topUpDoneesToExclusion: true,
  additionalDonees: 2,
  incrementalAppreciatedGift: 500_000,
  capitalGainDeferralShare: 0.5,
};

export interface ScenarioMetrics {
  totalModeledIncome: number;
  adjustedGrossIncome: number;
  deductionTaken: number;
  taxableIncome: number;
  ordinaryTax: number;
  capitalGainTax: number;
  netInvestmentIncomeTax: number;
  additionalMedicareTax: number;
  totalFederalTax: number;
  estimatedStateTax: number;
  totalModeledTax: number;
  effectiveRate: number;
  charitableDeductionAllowed: number;
  charitableCarryforward: number;
  totalGifted: number;
  giftsExcluded: number;
  taxableGiftsReported: number;
  lifetimeExclusionRemaining: number;
  /** Value moved out of the taxable estate in the modeled year. */
  assetsTransferred: number;
  /** Long-term gain intentionally moved out of the modeled year. */
  gainDeferred: number;
}

export interface Scenario {
  key: ScenarioKey;
  name: string;
  shortName: string;
  premise: string;
  assumptions: string[];
  authorityIds: string[];
  client: Client;
  federal: FederalModelResult;
  gifts: GiftAnalysis;
  metrics: ScenarioMetrics;
  gainDeferred: number;
}

export interface ScenarioComparison {
  parameters: ScenarioParameters;
  scenarios: Scenario[];
  baseline: Scenario;
}

function metricsFor(
  federal: FederalModelResult,
  gifts: GiftAnalysis,
  gainDeferred: number,
): ScenarioMetrics {
  return {
    totalModeledIncome: federal.income.totalModeledIncome,
    adjustedGrossIncome: federal.adjustedGrossIncome,
    deductionTaken: federal.deductionTaken,
    taxableIncome: federal.taxableIncome,
    ordinaryTax: federal.ordinaryTax,
    capitalGainTax: federal.capitalGainTax,
    netInvestmentIncomeTax: federal.netInvestmentIncomeTax,
    additionalMedicareTax: federal.additionalMedicareTax,
    totalFederalTax: federal.totalFederalTax,
    estimatedStateTax: federal.estimatedStateTax,
    totalModeledTax: federal.totalFederalTax + federal.estimatedStateTax,
    effectiveRate: federal.effectiveRateOnModeledIncome,
    charitableDeductionAllowed: federal.charitable.totalAllowed,
    charitableCarryforward: federal.charitable.disallowedCarryforward,
    totalGifted: gifts.totalGifted,
    giftsExcluded: gifts.totalExcluded,
    taxableGiftsReported: gifts.totalExceedingExclusion,
    lifetimeExclusionRemaining: gifts.remainingExclusion,
    assetsTransferred: gifts.totalGifted,
    gainDeferred,
  };
}

function buildScenario(
  key: ScenarioKey,
  name: string,
  shortName: string,
  premise: string,
  assumptions: string[],
  authorityIds: string[],
  client: Client,
  constants: TaxYearConstants,
  gainDeferred = 0,
): Scenario {
  const federal = runFederalModel(client, constants);
  const gifts = analyzeGifts(client, constants);
  return {
    key,
    name,
    shortName,
    premise,
    assumptions,
    authorityIds,
    client,
    federal,
    gifts,
    metrics: metricsFor(federal, gifts, gainDeferred),
    gainDeferred,
  };
}

function applyGiftPlanning(
  client: Client,
  constants: TaxYearConstants,
  parameters: ScenarioParameters,
): Client {
  const exclusion = constants.wealthTransfer.annualGiftExclusion;
  const multiplier = parameters.electGiftSplitting ? 2 : 1;

  const byRecipient = new Map<string, number>();
  for (const gift of client.gifts) {
    if (gift.recipientIsSpouse) continue;
    byRecipient.set(gift.recipient, (byRecipient.get(gift.recipient) ?? 0) + gift.amount);
  }

  const gifts: Gift[] = client.gifts.map((gift) =>
    gift.recipientIsSpouse || !gift.presentInterest
      ? gift
      : { ...gift, spouseElectsGiftSplitting: parameters.electGiftSplitting },
  );

  if (parameters.topUpDoneesToExclusion) {
    for (const [recipient, gifted] of byRecipient) {
      const source = client.gifts.find((gift) => gift.recipient === recipient);
      if (!source || !source.presentInterest) continue;
      const headroom = exclusion * multiplier - gifted;
      if (headroom <= 0) continue;
      gifts.push({
        ...source,
        id: `${source.id}-topup`,
        amount: headroom,
        assetType: 'cash',
        costBasis: undefined,
        spouseElectsGiftSplitting: parameters.electGiftSplitting,
        note: 'Modeled top-up to the full annual exclusion for this donee.',
      });
    }
  }

  for (let i = 0; i < parameters.additionalDonees; i += 1) {
    gifts.push({
      id: `modeled-donee-${i + 1}`,
      recipient: `Additional donee ${i + 1}`,
      relationship: 'Modeled donee',
      amount: exclusion * multiplier,
      assetType: 'cash',
      presentInterest: true,
      intoTrust: false,
      crummeyWithdrawalRight: false,
      spouseElectsGiftSplitting: parameters.electGiftSplitting,
      recipientIsSpouse: false,
      recipientIsUSCitizen: true,
      note: 'Hypothetical donee added by the gift planning scenario.',
    });
  }

  return { ...client, gifts };
}

function applyCharitableGiving(client: Client, parameters: ScenarioParameters): Client {
  return {
    ...client,
    deductions: {
      ...client.deductions,
      charitableAppreciatedSecurities:
        client.deductions.charitableAppreciatedSecurities + parameters.incrementalAppreciatedGift,
    },
  };
}

function applyCapitalGainTiming(client: Client, parameters: ScenarioParameters): Client {
  const deferred = client.income.longTermCapitalGain * parameters.capitalGainDeferralShare;
  return {
    ...client,
    income: {
      ...client.income,
      longTermCapitalGain: client.income.longTermCapitalGain - deferred,
    },
  };
}

/**
 * Builds the four comparison scenarios. Each is a copy of the client record
 * with one lever changed, re-run through the same model, so differences between
 * columns are attributable to the lever and nothing else.
 */
export function buildScenarios(
  client: Client,
  constants: TaxYearConstants,
  parameters: ScenarioParameters = DEFAULT_SCENARIO_PARAMETERS,
): ScenarioComparison {
  const current = buildScenario(
    'current',
    'Current position',
    'Current',
    'The client record as it stands, with no planning applied.',
    [
      'Income, deductions and transfers are taken from the client record without adjustment.',
      'Serves as the baseline against which the other three columns are measured.',
    ],
    ['irs-i1040-general'],
    client,
    constants,
  );

  const giftPlanning = buildScenario(
    'giftPlanning',
    'Gift planning',
    'Gift plan',
    'Uses the annual exclusion more fully across donees before it lapses at year end.',
    [
      parameters.electGiftSplitting
        ? `A § 2513 gift-splitting election is made, doubling the exclusion available per donee to ${(constants.wealthTransfer.annualGiftExclusion * 2).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}.`
        : 'No gift-splitting election is made.',
      parameters.topUpDoneesToExclusion
        ? 'Existing present-interest donees are topped up to the full exclusion available to them.'
        : 'Existing donees are left at their recorded amounts.',
      `${parameters.additionalDonees} additional donee${parameters.additionalDonees === 1 ? '' : 's'} at the full exclusion.`,
      'Income tax is unchanged in the modeled year; the effect is on transfer tax exposure and on income earned by the transferred assets in later years.',
    ],
    ['rp-2024-40-annual-gift-exclusion', 'irc-2513-gift-splitting', 'irs-i709-filing-requirement'],
    applyGiftPlanning(client, constants, parameters),
    constants,
  );

  const charitableGiving = buildScenario(
    'charitableGiving',
    'Charitable giving',
    'Charitable',
    'Contributes appreciated securities rather than cash, testing the 30% contribution base ceiling.',
    [
      `An incremental ${parameters.incrementalAppreciatedGift.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} of long-term appreciated securities is contributed to a public charity.`,
      'The contribution is measured against the 30% of contribution base ceiling; any excess carries forward.',
      'Gain on the contributed shares is not realized, so it does not appear in income in the modeled year.',
    ],
    ['irc-170b-agi-limits', 'irs-p526-charitable'],
    applyCharitableGiving(client, parameters),
    constants,
  );

  const deferredGain = client.income.longTermCapitalGain * parameters.capitalGainDeferralShare;
  const capitalGainTiming = buildScenario(
    'capitalGainTiming',
    'Capital gain timing',
    'Gain timing',
    'Moves part of the planned long-term gain out of the modeled year.',
    [
      `${(parameters.capitalGainDeferralShare * 100).toFixed(0)}% of modeled long-term capital gain is deferred to a later year.`,
      'The deferred gain is not taxed in a later year in this model; the comparison shows the effect on the modeled year only.',
      'Deferral changes the rate band the remaining gain falls into and the net investment income tax base.',
    ],
    ['rp-2024-40-capital-gains', 'irc-1411-niit', 'irs-tc409-capital-gains'],
    applyCapitalGainTiming(client, parameters),
    constants,
    deferredGain,
  );

  return {
    parameters,
    baseline: current,
    scenarios: [current, giftPlanning, charitableGiving, capitalGainTiming],
  };
}

export type MetricKey = keyof ScenarioMetrics;

export interface ScenarioRow {
  key: MetricKey;
  label: string;
  group: 'Income' | 'Deductions' | 'Federal tax' | 'Transfer tax';
  format: 'usd' | 'percent';
  /**
   * Colours the delta. `neutral` is used where neither direction is inherently
   * the better outcome, such as total income under a deferral scenario.
   */
  direction: 'lowerIsBetter' | 'higherIsBetter' | 'neutral';
}

export const SCENARIO_ROWS: ScenarioRow[] = [
  { key: 'totalModeledIncome', label: 'Total modeled income', group: 'Income', format: 'usd', direction: 'neutral' },
  { key: 'adjustedGrossIncome', label: 'Adjusted gross income', group: 'Income', format: 'usd', direction: 'neutral' },
  { key: 'gainDeferred', label: 'Long-term gain deferred', group: 'Income', format: 'usd', direction: 'neutral' },
  { key: 'deductionTaken', label: 'Deduction taken', group: 'Deductions', format: 'usd', direction: 'higherIsBetter' },
  { key: 'charitableDeductionAllowed', label: 'Charitable deduction allowed', group: 'Deductions', format: 'usd', direction: 'higherIsBetter' },
  { key: 'charitableCarryforward', label: 'Charitable amount carried forward', group: 'Deductions', format: 'usd', direction: 'lowerIsBetter' },
  { key: 'taxableIncome', label: 'Taxable income', group: 'Deductions', format: 'usd', direction: 'lowerIsBetter' },
  { key: 'ordinaryTax', label: 'Tax on ordinary income', group: 'Federal tax', format: 'usd', direction: 'lowerIsBetter' },
  { key: 'capitalGainTax', label: 'Tax on capital gain and qualified dividends', group: 'Federal tax', format: 'usd', direction: 'lowerIsBetter' },
  { key: 'netInvestmentIncomeTax', label: 'Net investment income tax', group: 'Federal tax', format: 'usd', direction: 'lowerIsBetter' },
  { key: 'additionalMedicareTax', label: 'Additional Medicare tax', group: 'Federal tax', format: 'usd', direction: 'lowerIsBetter' },
  { key: 'totalFederalTax', label: 'Total modeled federal tax', group: 'Federal tax', format: 'usd', direction: 'lowerIsBetter' },
  { key: 'estimatedStateTax', label: 'Estimated state tax', group: 'Federal tax', format: 'usd', direction: 'lowerIsBetter' },
  { key: 'effectiveRate', label: 'Effective rate on modeled income', group: 'Federal tax', format: 'percent', direction: 'lowerIsBetter' },
  { key: 'totalGifted', label: 'Total transferred', group: 'Transfer tax', format: 'usd', direction: 'higherIsBetter' },
  { key: 'giftsExcluded', label: 'Covered by annual exclusion', group: 'Transfer tax', format: 'usd', direction: 'higherIsBetter' },
  { key: 'taxableGiftsReported', label: 'Reportable taxable gifts', group: 'Transfer tax', format: 'usd', direction: 'lowerIsBetter' },
  { key: 'lifetimeExclusionRemaining', label: 'Lifetime exclusion remaining', group: 'Transfer tax', format: 'usd', direction: 'higherIsBetter' },
];
