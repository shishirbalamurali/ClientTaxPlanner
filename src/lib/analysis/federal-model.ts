import type { RateBracket, TaxYearConstants } from '@/lib/tax-year';
import type { Client, FilingStatus } from '@/lib/types';

/**
 * A deliberately simplified federal model. It is accurate enough to compare
 * scenarios against one another and to size the review items raised elsewhere
 * in the application, and it is not a return preparation engine. Known
 * omissions are listed in MODEL_LIMITATIONS and surfaced in the UI.
 */

export const MODEL_LIMITATIONS = [
  'Alternative minimum tax is screened for but not computed; no tentative minimum tax is calculated.',
  'The qualified business income deduction is screened for but not computed; wage and qualified property limitations are not applied.',
  'Passive activity loss, at-risk and excess business loss limitations are not applied.',
  'Credits other than the effect of the standard or itemized deduction are excluded, including the foreign tax credit.',
  'State and local income tax is estimated with a single top marginal rate and is not a state return calculation.',
  'Self-employment tax is not computed on business income.',
  'Charitable carryforwards are tracked but the five-year ordering rules are not applied.',
];

export function bracketTax(taxableIncome: number, brackets: readonly RateBracket[]): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  for (let i = 0; i < brackets.length; i += 1) {
    const bracket = brackets[i]!;
    if (taxableIncome <= bracket.floor) break;
    const ceiling = brackets[i + 1]?.floor ?? Number.POSITIVE_INFINITY;
    const slice = Math.min(taxableIncome, ceiling) - bracket.floor;
    tax += slice * bracket.rate;
  }
  return tax;
}

export function marginalRate(taxableIncome: number, brackets: readonly RateBracket[]): number {
  let rate = brackets[0]?.rate ?? 0;
  for (const bracket of brackets) {
    if (taxableIncome > bracket.floor) rate = bracket.rate;
  }
  return rate;
}

export interface IncomeBreakdown {
  employment: number;
  interest: number;
  dividends: number;
  capitalGains: number;
  business: number;
  rental: number;
  trustDistributions: number;
  retirement: number;
  other: number;
}

export interface IncomeSummary {
  breakdown: IncomeBreakdown;
  /** Excludes tax-exempt interest, which is tracked separately. */
  totalModeledIncome: number;
  taxExemptInterest: number;
  ordinaryIncome: number;
  preferentialIncome: number;
  netInvestmentIncome: number;
  investmentIncome: number;
  netCapitalGain: number;
  shortTermCapitalGain: number;
  longTermCapitalGain: number;
  earnedIncome: number;
}

export function summarizeIncome(client: Client): IncomeSummary {
  const i = client.income;

  const employment = i.wages + i.bonus + i.equityCompensation;
  const dividends = i.qualifiedDividends + i.nonQualifiedDividends;
  const capitalGains = i.shortTermCapitalGain + i.longTermCapitalGain;

  const breakdown: IncomeBreakdown = {
    employment,
    interest: i.taxableInterest,
    dividends,
    capitalGains,
    business: i.businessIncome,
    rental: i.rentalIncome,
    trustDistributions: i.trustDistributions,
    retirement: i.retirementDistributions,
    other: i.otherIncome,
  };

  const totalModeledIncome = Object.values(breakdown).reduce((sum, value) => sum + value, 0);

  // Long-term gain and qualified dividends are taxed at the preferential rates;
  // everything else stacks below them at ordinary rates.
  const preferentialIncome = Math.max(0, i.longTermCapitalGain) + i.qualifiedDividends;
  const ordinaryIncome = totalModeledIncome - preferentialIncome;

  const investmentIncome =
    i.taxableInterest + dividends + capitalGains + i.rentalIncome + i.trustDistributions;

  return {
    breakdown,
    totalModeledIncome,
    taxExemptInterest: i.taxExemptInterest,
    ordinaryIncome,
    preferentialIncome,
    netInvestmentIncome: investmentIncome,
    investmentIncome,
    netCapitalGain: capitalGains,
    shortTermCapitalGain: i.shortTermCapitalGain,
    longTermCapitalGain: i.longTermCapitalGain,
    earnedIncome: employment,
  };
}

export interface SaltResult {
  paid: number;
  cap: number;
  allowed: number;
  capReducedBy: number;
  phaseDownApplies: boolean;
}

export function applySaltLimitation(
  paid: number,
  modifiedAgi: number,
  filingStatus: FilingStatus,
  constants: TaxYearConstants,
): SaltResult {
  const { cap, floor, phaseDownModifiedAgiThreshold, phaseDownRate } = constants.saltLimitation;
  const statutoryCap = cap[filingStatus];
  const threshold = phaseDownModifiedAgiThreshold[filingStatus];
  const excess = Math.max(0, modifiedAgi - threshold);
  const reduction = excess * phaseDownRate;
  const effectiveCap = Math.max(floor[filingStatus], statutoryCap - reduction);

  return {
    paid,
    cap: effectiveCap,
    allowed: Math.min(paid, effectiveCap),
    capReducedBy: statutoryCap - effectiveCap,
    phaseDownApplies: excess > 0,
  };
}

export interface CharitableResult {
  cash: number;
  appreciated: number;
  privateFoundation: number;
  cashAllowed: number;
  appreciatedAllowed: number;
  privateFoundationAllowed: number;
  totalAllowed: number;
  totalContributed: number;
  disallowedCarryforward: number;
  cashLimit: number;
  appreciatedLimit: number;
}

export function applyCharitableLimits(
  client: Client,
  contributionBase: number,
  constants: TaxYearConstants,
): CharitableResult {
  const limits = constants.charitableAgiLimits;
  const { charitableCash, charitableAppreciatedSecurities, charitablePrivateFoundation } =
    client.deductions;

  const cashLimit = contributionBase * limits.cashToPublicCharity;
  const appreciatedLimit = contributionBase * limits.appreciatedPropertyToPublicCharity;
  const foundationLimit = contributionBase * limits.cashToPrivateFoundation;

  // Appreciated property to public charities is applied against the 30% ceiling
  // first, then cash fills the remaining room under the 60% overall ceiling.
  const appreciatedAllowed = Math.min(charitableAppreciatedSecurities, appreciatedLimit);
  const foundationAllowed = Math.min(
    charitablePrivateFoundation,
    Math.max(0, foundationLimit - appreciatedAllowed),
  );
  const cashAllowed = Math.min(
    charitableCash,
    Math.max(0, cashLimit - appreciatedAllowed - foundationAllowed),
  );

  const totalContributed =
    charitableCash + charitableAppreciatedSecurities + charitablePrivateFoundation;
  const totalAllowed = cashAllowed + appreciatedAllowed + foundationAllowed;

  return {
    cash: charitableCash,
    appreciated: charitableAppreciatedSecurities,
    privateFoundation: charitablePrivateFoundation,
    cashAllowed,
    appreciatedAllowed,
    privateFoundationAllowed: foundationAllowed,
    totalAllowed,
    totalContributed,
    disallowedCarryforward: totalContributed - totalAllowed,
    cashLimit,
    appreciatedLimit,
  };
}

export interface FederalModelResult {
  income: IncomeSummary;
  adjustedGrossIncome: number;
  salt: SaltResult;
  charitable: CharitableResult;
  itemizedDeductions: number;
  standardDeduction: number;
  deductionTaken: number;
  deductionMethod: 'itemized' | 'standard';
  taxableIncome: number;
  ordinaryTaxableIncome: number;
  preferentialTaxableIncome: number;
  ordinaryTax: number;
  capitalGainTax: number;
  capitalGainDetail: { atZero: number; atFifteen: number; atTwenty: number };
  netInvestmentIncomeTax: number;
  netInvestmentIncomeTaxBase: number;
  additionalMedicareTax: number;
  totalFederalTax: number;
  effectiveRateOnModeledIncome: number;
  marginalOrdinaryRate: number;
  estimatedStateTax: number;
}

export function runFederalModel(client: Client, constants: TaxYearConstants): FederalModelResult {
  const income = summarizeIncome(client);
  const status = client.filingStatus;

  const adjustedGrossIncome = income.totalModeledIncome;
  const salt = applySaltLimitation(
    client.deductions.stateAndLocalTaxesPaid,
    adjustedGrossIncome,
    status,
    constants,
  );
  const charitable = applyCharitableLimits(client, adjustedGrossIncome, constants);

  const medicalFloor = adjustedGrossIncome * 0.075;
  const deductibleMedical = Math.max(0, client.deductions.medicalExpenses - medicalFloor);
  const investmentInterest = Math.min(
    client.deductions.investmentInterestExpense,
    income.investmentIncome,
  );

  const itemizedDeductions =
    salt.allowed +
    charitable.totalAllowed +
    client.deductions.mortgageInterest +
    deductibleMedical +
    investmentInterest;

  const standardDeduction = constants.standardDeduction[status];
  const useItemized = itemizedDeductions > standardDeduction;
  const deductionTaken = useItemized ? itemizedDeductions : standardDeduction;

  const taxableIncome = Math.max(0, adjustedGrossIncome - deductionTaken);
  const preferentialTaxableIncome = Math.min(income.preferentialIncome, taxableIncome);
  const ordinaryTaxableIncome = taxableIncome - preferentialTaxableIncome;

  const brackets = constants.ordinaryRates[status];
  const ordinaryTax = bracketTax(ordinaryTaxableIncome, brackets);

  const breakpoints = constants.capitalGainBreakpoints[status];
  const zeroRoom = Math.max(0, breakpoints.maximumZeroRateAmount - ordinaryTaxableIncome);
  const atZero = Math.min(preferentialTaxableIncome, zeroRoom);
  const fifteenRoom = Math.max(
    0,
    breakpoints.maximumFifteenPercentAmount - Math.max(ordinaryTaxableIncome, breakpoints.maximumZeroRateAmount),
  );
  const atFifteen = Math.min(preferentialTaxableIncome - atZero, fifteenRoom);
  const atTwenty = Math.max(0, preferentialTaxableIncome - atZero - atFifteen);

  const capitalGainTax =
    atZero * constants.capitalGainRates.zero +
    atFifteen * constants.capitalGainRates.mid +
    atTwenty * constants.capitalGainRates.top;

  const niitThreshold = constants.netInvestmentIncomeTax.thresholds[status];
  const netInvestmentIncomeTaxBase = Math.max(
    0,
    Math.min(income.netInvestmentIncome, adjustedGrossIncome - niitThreshold),
  );
  const netInvestmentIncomeTax = netInvestmentIncomeTaxBase * constants.netInvestmentIncomeTax.rate;

  const medicareThreshold = constants.additionalMedicareTax.thresholds[status];
  const additionalMedicareTax =
    Math.max(0, income.earnedIncome - medicareThreshold) * constants.additionalMedicareTax.rate;

  const totalFederalTax =
    ordinaryTax + capitalGainTax + netInvestmentIncomeTax + additionalMedicareTax;

  return {
    income,
    adjustedGrossIncome,
    salt,
    charitable,
    itemizedDeductions,
    standardDeduction,
    deductionTaken,
    deductionMethod: useItemized ? 'itemized' : 'standard',
    taxableIncome,
    ordinaryTaxableIncome,
    preferentialTaxableIncome,
    ordinaryTax,
    capitalGainTax,
    capitalGainDetail: { atZero, atFifteen, atTwenty },
    netInvestmentIncomeTax,
    netInvestmentIncomeTaxBase,
    additionalMedicareTax,
    totalFederalTax,
    effectiveRateOnModeledIncome:
      adjustedGrossIncome > 0 ? totalFederalTax / adjustedGrossIncome : 0,
    marginalOrdinaryRate: marginalRate(ordinaryTaxableIncome, brackets),
    estimatedStateTax: Math.max(0, taxableIncome) * client.residency.topMarginalStateRate,
  };
}
