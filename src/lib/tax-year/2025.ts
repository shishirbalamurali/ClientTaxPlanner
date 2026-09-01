import type { TaxYearConstants } from './types';

const MFJ_BRACKETS = [
  { floor: 0, rate: 0.1 },
  { floor: 23_850, rate: 0.12 },
  { floor: 96_950, rate: 0.22 },
  { floor: 206_700, rate: 0.24 },
  { floor: 394_600, rate: 0.32 },
  { floor: 501_050, rate: 0.35 },
  { floor: 751_600, rate: 0.37 },
];

const SINGLE_BRACKETS = [
  { floor: 0, rate: 0.1 },
  { floor: 11_925, rate: 0.12 },
  { floor: 48_475, rate: 0.22 },
  { floor: 103_350, rate: 0.24 },
  { floor: 197_300, rate: 0.32 },
  { floor: 250_525, rate: 0.35 },
  { floor: 626_350, rate: 0.37 },
];

const HOH_BRACKETS = [
  { floor: 0, rate: 0.1 },
  { floor: 17_000, rate: 0.12 },
  { floor: 64_850, rate: 0.22 },
  { floor: 103_350, rate: 0.24 },
  { floor: 197_300, rate: 0.32 },
  { floor: 250_500, rate: 0.35 },
  { floor: 626_350, rate: 0.37 },
];

const MFS_BRACKETS = [
  { floor: 0, rate: 0.1 },
  { floor: 11_925, rate: 0.12 },
  { floor: 48_475, rate: 0.22 },
  { floor: 103_350, rate: 0.24 },
  { floor: 197_300, rate: 0.32 },
  { floor: 250_525, rate: 0.35 },
  { floor: 375_800, rate: 0.37 },
];

/**
 * Figures below are the published 2025 amounts. Rate schedules, standard
 * deductions and the transfer-tax amounts come from Rev. Proc. 2024-40 as
 * modified for 2025 by P.L. 119-21; statutory amounts that carry no annual
 * inflation adjustment (net investment income tax, FBAR, Form 8938) are taken
 * from the underlying section or regulation.
 */
export const TAX_YEAR_2025: TaxYearConstants = {
  year: 2025,
  label: 'Tax year 2025',

  sourceKeys: {
    rateSchedules: 'rp-2024-40-rate-schedules',
    standardDeduction: 'pl-119-21-standard-deduction',
    capitalGains: 'rp-2024-40-capital-gains',
    annualGiftExclusion: 'rp-2024-40-annual-gift-exclusion',
    basicExclusionAmount: 'rp-2024-40-basic-exclusion',
    fiduciaryRates: 'rp-2024-40-estates-trusts',
    netInvestmentIncomeTax: 'irc-1411-niit',
    additionalMedicareTax: 'irc-3101b-additional-medicare',
    fbarThreshold: 'fincen-114-threshold',
    form8938Thresholds: 'form-8938-thresholds',
    saltLimitation: 'pl-119-21-salt-cap',
    charitableLimits: 'irc-170b-agi-limits',
    qualifiedBusinessIncome: 'rp-2024-40-199a',
    alternativeMinimumTax: 'rp-2024-40-amt',
    estimatedTaxSafeHarbor: 'irc-6654-safe-harbor',
  },

  ordinaryRates: {
    single: SINGLE_BRACKETS,
    marriedFilingJointly: MFJ_BRACKETS,
    marriedFilingSeparately: MFS_BRACKETS,
    headOfHousehold: HOH_BRACKETS,
    qualifyingSurvivingSpouse: MFJ_BRACKETS,
  },

  standardDeduction: {
    single: 15_750,
    marriedFilingJointly: 31_500,
    marriedFilingSeparately: 15_750,
    headOfHousehold: 23_625,
    qualifyingSurvivingSpouse: 31_500,
  },

  capitalGainBreakpoints: {
    single: { maximumZeroRateAmount: 48_350, maximumFifteenPercentAmount: 533_400 },
    marriedFilingJointly: { maximumZeroRateAmount: 96_700, maximumFifteenPercentAmount: 600_050 },
    marriedFilingSeparately: { maximumZeroRateAmount: 48_350, maximumFifteenPercentAmount: 300_000 },
    headOfHousehold: { maximumZeroRateAmount: 64_750, maximumFifteenPercentAmount: 566_700 },
    qualifyingSurvivingSpouse: {
      maximumZeroRateAmount: 96_700,
      maximumFifteenPercentAmount: 600_050,
    },
  },

  capitalGainRates: { zero: 0, mid: 0.15, top: 0.2 },

  netInvestmentIncomeTax: {
    rate: 0.038,
    thresholds: {
      single: 200_000,
      marriedFilingJointly: 250_000,
      marriedFilingSeparately: 125_000,
      headOfHousehold: 200_000,
      qualifyingSurvivingSpouse: 250_000,
    },
  },

  additionalMedicareTax: {
    rate: 0.009,
    thresholds: {
      single: 200_000,
      marriedFilingJointly: 250_000,
      marriedFilingSeparately: 125_000,
      headOfHousehold: 200_000,
      qualifyingSurvivingSpouse: 250_000,
    },
  },

  alternativeMinimumTax: {
    exemption: {
      single: 88_100,
      marriedFilingJointly: 137_000,
      marriedFilingSeparately: 68_500,
      headOfHousehold: 88_100,
      qualifyingSurvivingSpouse: 137_000,
    },
    exemptionPhaseoutThreshold: {
      single: 626_350,
      marriedFilingJointly: 1_252_700,
      marriedFilingSeparately: 626_350,
      headOfHousehold: 626_350,
      qualifyingSurvivingSpouse: 1_252_700,
    },
    lowerRate: 0.26,
    upperRate: 0.28,
    upperRateThreshold: {
      single: 239_100,
      marriedFilingJointly: 239_100,
      marriedFilingSeparately: 119_550,
      headOfHousehold: 239_100,
      qualifyingSurvivingSpouse: 239_100,
    },
  },

  qualifiedBusinessIncome: {
    deductionRate: 0.2,
    thresholdAmount: {
      single: 197_300,
      marriedFilingJointly: 394_600,
      marriedFilingSeparately: 197_300,
      headOfHousehold: 197_300,
      qualifyingSurvivingSpouse: 394_600,
    },
    phaseInCeiling: {
      single: 247_300,
      marriedFilingJointly: 494_600,
      marriedFilingSeparately: 247_300,
      headOfHousehold: 247_300,
      qualifyingSurvivingSpouse: 494_600,
    },
  },

  saltLimitation: {
    cap: {
      single: 40_000,
      marriedFilingJointly: 40_000,
      marriedFilingSeparately: 20_000,
      headOfHousehold: 40_000,
      qualifyingSurvivingSpouse: 40_000,
    },
    floor: {
      single: 10_000,
      marriedFilingJointly: 10_000,
      marriedFilingSeparately: 5_000,
      headOfHousehold: 10_000,
      qualifyingSurvivingSpouse: 10_000,
    },
    phaseDownModifiedAgiThreshold: {
      single: 500_000,
      marriedFilingJointly: 500_000,
      marriedFilingSeparately: 250_000,
      headOfHousehold: 500_000,
      qualifyingSurvivingSpouse: 500_000,
    },
    phaseDownRate: 0.3,
  },

  charitableAgiLimits: {
    cashToPublicCharity: 0.6,
    appreciatedPropertyToPublicCharity: 0.3,
    cashToPrivateFoundation: 0.3,
    appreciatedPropertyToPrivateFoundation: 0.2,
    carryforwardYears: 5,
  },

  wealthTransfer: {
    annualGiftExclusion: 19_000,
    noncitizenSpouseAnnualExclusion: 190_000,
    basicExclusionAmount: 13_990_000,
    topTransferTaxRate: 0.4,
    generationSkippingExemption: 13_990_000,
  },

  fiduciary: {
    rates: [
      { floor: 0, rate: 0.1 },
      { floor: 3_150, rate: 0.24 },
      { floor: 11_450, rate: 0.35 },
      { floor: 15_650, rate: 0.37 },
    ],
    exemptionSimpleTrust: 300,
    exemptionComplexTrust: 100,
    grossIncomeFilingThreshold: 600,
    netInvestmentIncomeThreshold: 15_650,
    alternativeMinimumTaxExemption: 30_700,
  },

  foreignReporting: {
    fbarAggregateThreshold: 10_000,
    form8938: {
      livingInUS: {
        single: { yearEnd: 50_000, anyTime: 75_000 },
        marriedFilingJointly: { yearEnd: 100_000, anyTime: 150_000 },
        marriedFilingSeparately: { yearEnd: 50_000, anyTime: 75_000 },
        headOfHousehold: { yearEnd: 50_000, anyTime: 75_000 },
        qualifyingSurvivingSpouse: { yearEnd: 100_000, anyTime: 150_000 },
      },
      livingAbroad: {
        single: { yearEnd: 200_000, anyTime: 300_000 },
        marriedFilingJointly: { yearEnd: 400_000, anyTime: 600_000 },
        marriedFilingSeparately: { yearEnd: 200_000, anyTime: 300_000 },
        headOfHousehold: { yearEnd: 200_000, anyTime: 300_000 },
        qualifyingSurvivingSpouse: { yearEnd: 400_000, anyTime: 600_000 },
      },
    },
    foreignGiftFromIndividualThreshold: 100_000,
    controlledForeignCorporationOwnershipThreshold: 0.1,
  },

  estimatedTax: {
    priorYearSafeHarborRate: 1.0,
    highIncomeSafeHarborRate: 1.1,
    highIncomeAgiThreshold: 150_000,
    currentYearSafeHarborRate: 0.9,
  },
};
