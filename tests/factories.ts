import type {
  BalanceSheet,
  Client,
  DeductionProfile,
  ForeignAccount,
  Gift,
  IncomeProfile,
  ResidencyProfile,
  TrustIncome,
  TrustRecord,
} from '@/lib/types';

/** Nested groups are overridable field by field so a test states only what it cares about. */
export type ClientOverrides = Partial<
  Omit<Client, 'income' | 'deductions' | 'residency' | 'balanceSheet'>
> & {
  income?: Partial<IncomeProfile>;
  deductions?: Partial<DeductionProfile>;
  residency?: Partial<ResidencyProfile>;
  balanceSheet?: Partial<BalanceSheet>;
};

export type TrustOverrides = Partial<Omit<TrustRecord, 'income'>> & {
  income?: Partial<TrustIncome>;
};

/** Minimal client used as the base for rule tests; every field is overridable. */
export const BASE_CLIENT: Client = {
  id: 'test-client',
  displayName: 'Test Client',
  archetype: 'corporateExecutive',
  archetypeLabel: 'Corporate executive',
  engagementRef: 'TEST-2025-001',
  taxYear: 2025,
  age: 50,
  spouseName: 'Test Spouse',
  spouseAge: 50,
  spouseIsUSCitizen: true,
  filingStatus: 'marriedFilingJointly',
  residency: {
    stateCode: 'TX',
    stateName: 'Texas',
    topMarginalStateRate: 0,
    residencyNote: 'No individual income tax.',
    livesAbroad: false,
  },
  occupation: 'Executive',
  employer: 'Test Employer',
  dependents: [],
  income: {
    wages: 400_000,
    bonus: 0,
    equityCompensation: 0,
    taxableInterest: 0,
    taxExemptInterest: 0,
    qualifiedDividends: 0,
    nonQualifiedDividends: 0,
    shortTermCapitalGain: 0,
    longTermCapitalGain: 0,
    businessIncome: 0,
    rentalIncome: 0,
    trustDistributions: 0,
    retirementDistributions: 0,
    otherIncome: 0,
  },
  deductions: {
    charitableCash: 0,
    charitableAppreciatedSecurities: 0,
    charitablePrivateFoundation: 0,
    stateAndLocalTaxesPaid: 0,
    mortgageInterest: 0,
    medicalExpenses: 0,
    investmentInterestExpense: 0,
    charitableCarryforward: 0,
  },
  balanceSheet: {
    cashAndEquivalents: 100_000,
    marketablePortfolio: 1_000_000,
    concentratedPositions: [],
    privateBusinessInterests: 0,
    retirementAccounts: 0,
    realEstate: [],
    otherLiabilities: 0,
  },
  gifts: [],
  foreignAccounts: [],
  foreignEntities: [],
  trusts: [],
  priorYearAdjustedGrossIncome: 100_000,
  priorYearTaxableGiftsReported: 0,
  lifetimeExclusionPreviouslyUsed: 0,
  advisorNotes: [],
};

export function makeClient(overrides: ClientOverrides = {}): Client {
  return {
    ...BASE_CLIENT,
    ...overrides,
    income: { ...BASE_CLIENT.income, ...overrides.income },
    deductions: { ...BASE_CLIENT.deductions, ...overrides.deductions },
    residency: { ...BASE_CLIENT.residency, ...overrides.residency },
    balanceSheet: { ...BASE_CLIENT.balanceSheet, ...overrides.balanceSheet },
  };
}

export function makeGift(overrides: Partial<Gift> = {}): Gift {
  return {
    id: 'gift-1',
    recipient: 'Donee One',
    relationship: 'Son',
    amount: 10_000,
    assetType: 'cash',
    presentInterest: true,
    intoTrust: false,
    crummeyWithdrawalRight: false,
    spouseElectsGiftSplitting: false,
    recipientIsSpouse: false,
    recipientIsUSCitizen: true,
    ...overrides,
  };
}

export function makeForeignAccount(overrides: Partial<ForeignAccount> = {}): ForeignAccount {
  const maximumValueUSD = overrides.maximumValueUSD ?? 5_000;
  return {
    id: 'fa-1',
    institution: 'Test Bank',
    country: 'Testland',
    accountType: 'depository',
    maximumValueUSD,
    yearEndValueUSD: overrides.yearEndValueUSD ?? maximumValueUSD,
    localCurrency: 'EUR',
    interestType: 'ownerOfRecord',
    openedYear: 2015,
    ...overrides,
  };
}

const NO_TRUST_INCOME: TrustIncome = {
  interest: 0,
  dividends: 0,
  capitalGains: 0,
  rental: 0,
  other: 0,
};

export function makeTrust(overrides: TrustOverrides = {}): TrustRecord {
  return {
    id: 'trust-1',
    name: 'Test Trust',
    kind: 'irrevocableNonGrantor',
    situs: 'Delaware',
    yearEstablished: 2015,
    grantor: 'Test Client',
    trustee: 'Test Trustee',
    beneficiaries: ['Beneficiary One'],
    principalValue: 1_000_000,
    distributionsToBeneficiaries: 0,
    capitalGainsAllocatedToIncome: true,
    fiduciaryFees: 0,
    stateAndLocalTaxes: 0,
    hasNonresidentAlienBeneficiary: false,
    isForeignTrust: false,
    ...overrides,
    income: { ...NO_TRUST_INCOME, ...overrides.income },
  };
}

export function findingIds(findings: { ruleId: string }[]): string[] {
  return findings.map((finding) => finding.ruleId);
}
