import type { FilingStatus } from '@/lib/types';

export interface RateBracket {
  /** Lower bound of the bracket, inclusive. */
  floor: number;
  rate: number;
}

export type ByFilingStatus<T> = Record<FilingStatus, T>;

export interface CapitalGainBreakpoints {
  maximumZeroRateAmount: number;
  maximumFifteenPercentAmount: number;
}

export interface Form8938Threshold {
  yearEnd: number;
  anyTime: number;
}

/**
 * Every figure the models depend on lives here so a new filing season is a data
 * change rather than a code change. `sourceKey` values resolve against the
 * research library in `src/lib/research/authorities.ts`.
 */
export interface TaxYearConstants {
  year: number;
  label: string;
  /** Statutory citation notes surfaced next to each block in the UI. */
  sourceKeys: {
    rateSchedules: string;
    standardDeduction: string;
    capitalGains: string;
    annualGiftExclusion: string;
    basicExclusionAmount: string;
    fiduciaryRates: string;
    netInvestmentIncomeTax: string;
    additionalMedicareTax: string;
    fbarThreshold: string;
    form8938Thresholds: string;
    saltLimitation: string;
    charitableLimits: string;
    qualifiedBusinessIncome: string;
    alternativeMinimumTax: string;
    estimatedTaxSafeHarbor: string;
  };

  ordinaryRates: ByFilingStatus<RateBracket[]>;
  standardDeduction: ByFilingStatus<number>;
  capitalGainBreakpoints: ByFilingStatus<CapitalGainBreakpoints>;
  capitalGainRates: { zero: number; mid: number; top: number };

  netInvestmentIncomeTax: { rate: number; thresholds: ByFilingStatus<number> };
  additionalMedicareTax: { rate: number; thresholds: ByFilingStatus<number> };

  alternativeMinimumTax: {
    exemption: ByFilingStatus<number>;
    exemptionPhaseoutThreshold: ByFilingStatus<number>;
    lowerRate: number;
    upperRate: number;
    upperRateThreshold: ByFilingStatus<number>;
  };

  qualifiedBusinessIncome: {
    deductionRate: number;
    thresholdAmount: ByFilingStatus<number>;
    phaseInCeiling: ByFilingStatus<number>;
  };

  saltLimitation: {
    cap: ByFilingStatus<number>;
    floor: ByFilingStatus<number>;
    phaseDownModifiedAgiThreshold: ByFilingStatus<number>;
    phaseDownRate: number;
  };

  charitableAgiLimits: {
    cashToPublicCharity: number;
    appreciatedPropertyToPublicCharity: number;
    cashToPrivateFoundation: number;
    appreciatedPropertyToPrivateFoundation: number;
    carryforwardYears: number;
  };

  wealthTransfer: {
    annualGiftExclusion: number;
    noncitizenSpouseAnnualExclusion: number;
    basicExclusionAmount: number;
    topTransferTaxRate: number;
    generationSkippingExemption: number;
  };

  fiduciary: {
    rates: RateBracket[];
    exemptionSimpleTrust: number;
    exemptionComplexTrust: number;
    grossIncomeFilingThreshold: number;
    netInvestmentIncomeThreshold: number;
    alternativeMinimumTaxExemption: number;
  };

  foreignReporting: {
    fbarAggregateThreshold: number;
    form8938: {
      livingInUS: ByFilingStatus<Form8938Threshold>;
      livingAbroad: ByFilingStatus<Form8938Threshold>;
    };
    foreignGiftFromIndividualThreshold: number;
    controlledForeignCorporationOwnershipThreshold: number;
  };

  estimatedTax: {
    priorYearSafeHarborRate: number;
    highIncomeSafeHarborRate: number;
    highIncomeAgiThreshold: number;
    currentYearSafeHarborRate: number;
  };
}
