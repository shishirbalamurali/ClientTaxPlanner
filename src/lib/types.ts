export type FilingStatus =
  | 'single'
  | 'marriedFilingJointly'
  | 'marriedFilingSeparately'
  | 'headOfHousehold'
  | 'qualifyingSurvivingSpouse';

export type ClientArchetype = 'corporateExecutive' | 'businessOwner' | 'internationalExecutive';

export interface Dependent {
  name: string;
  relationship: string;
  age: number;
  inCollege?: boolean;
}

/**
 * Income lines are grouped the way a 1040 organizer groups them so that the
 * mapping from client fact to return line stays legible. Amounts are modeled
 * annual figures, not amounts drawn from any filed return.
 */
export interface IncomeProfile {
  wages: number;
  bonus: number;
  equityCompensation: number;
  taxableInterest: number;
  taxExemptInterest: number;
  qualifiedDividends: number;
  nonQualifiedDividends: number;
  shortTermCapitalGain: number;
  longTermCapitalGain: number;
  businessIncome: number;
  rentalIncome: number;
  trustDistributions: number;
  retirementDistributions: number;
  otherIncome: number;
}

export interface DeductionProfile {
  charitableCash: number;
  charitableAppreciatedSecurities: number;
  charitablePrivateFoundation: number;
  stateAndLocalTaxesPaid: number;
  mortgageInterest: number;
  medicalExpenses: number;
  investmentInterestExpense: number;
  charitableCarryforward: number;
}

export interface RealEstateHolding {
  label: string;
  location: string;
  use: 'primaryResidence' | 'secondResidence' | 'rental' | 'landHeldForInvestment';
  marketValue: number;
  costBasis: number;
  mortgageBalance: number;
}

export interface ConcentratedPosition {
  label: string;
  marketValue: number;
  costBasis: number;
  acquiredVia: string;
}

export interface BalanceSheet {
  cashAndEquivalents: number;
  marketablePortfolio: number;
  concentratedPositions: ConcentratedPosition[];
  privateBusinessInterests: number;
  retirementAccounts: number;
  realEstate: RealEstateHolding[];
  otherLiabilities: number;
}

export type GiftAssetType =
  | 'cash'
  | 'marketableSecurities'
  | 'realProperty'
  | 'closelyHeldBusinessInterest';

export interface Gift {
  id: string;
  recipient: string;
  relationship: string;
  amount: number;
  assetType: GiftAssetType;
  /** Present-interest gifts qualify for the annual exclusion; future interests do not. */
  presentInterest: boolean;
  /** True when the transfer was made to a trust rather than outright. */
  intoTrust: boolean;
  /** Crummey withdrawal rights convert a transfer in trust into a present interest. */
  crummeyWithdrawalRight: boolean;
  spouseElectsGiftSplitting: boolean;
  recipientIsSpouse: boolean;
  recipientIsUSCitizen: boolean;
  /** For non-cash gifts, the donor's carryover basis. */
  costBasis?: number;
  note?: string;
}

export type ForeignAccountType =
  | 'depository'
  | 'custodial'
  | 'brokerage'
  | 'pooledInvestmentFund'
  | 'insuranceOrAnnuity'
  | 'pension';

export type ForeignAccountInterest = 'ownerOfRecord' | 'jointOwner' | 'signatureAuthorityOnly';

export interface ForeignAccount {
  id: string;
  institution: string;
  country: string;
  accountType: ForeignAccountType;
  /** Maximum value during the calendar year, converted to USD. */
  maximumValueUSD: number;
  yearEndValueUSD: number;
  localCurrency: string;
  interestType: ForeignAccountInterest;
  /** Employer-sponsored plans are treated separately in several review notes. */
  isEmployerPlan?: boolean;
  openedYear: number;
}

export type ForeignEntityKind =
  | 'foreignCorporation'
  | 'foreignPartnership'
  | 'passiveForeignInvestmentCompany'
  | 'foreignTrust';

export interface ForeignEntityInterest {
  id: string;
  name: string;
  country: string;
  kind: ForeignEntityKind;
  ownershipPercent: number;
  valueUSD: number;
  note?: string;
}

export type TrustKind =
  | 'grantorRevocable'
  | 'irrevocableNonGrantor'
  | 'irrevocableGrantor'
  | 'charitableRemainderUnitrust';

export interface TrustIncome {
  interest: number;
  dividends: number;
  capitalGains: number;
  rental: number;
  other: number;
}

export interface TrustRecord {
  id: string;
  name: string;
  kind: TrustKind;
  situs: string;
  yearEstablished: number;
  grantor: string;
  trustee: string;
  beneficiaries: string[];
  principalValue: number;
  income: TrustIncome;
  distributionsToBeneficiaries: number;
  /** Whether capital gains are allocated to income under the governing instrument or local law. */
  capitalGainsAllocatedToIncome: boolean;
  fiduciaryFees: number;
  stateAndLocalTaxes: number;
  hasNonresidentAlienBeneficiary: boolean;
  isForeignTrust: boolean;
}

export interface ResidencyProfile {
  stateCode: string;
  stateName: string;
  topMarginalStateRate: number;
  residencyNote: string;
  livesAbroad: boolean;
  countryOfResidence?: string;
}

export interface Client {
  id: string;
  displayName: string;
  archetype: ClientArchetype;
  archetypeLabel: string;
  engagementRef: string;
  taxYear: number;
  age: number;
  spouseName?: string;
  spouseAge?: number;
  spouseIsUSCitizen: boolean;
  filingStatus: FilingStatus;
  residency: ResidencyProfile;
  occupation: string;
  employer: string;
  dependents: Dependent[];
  income: IncomeProfile;
  deductions: DeductionProfile;
  balanceSheet: BalanceSheet;
  gifts: Gift[];
  foreignAccounts: ForeignAccount[];
  foreignEntities: ForeignEntityInterest[];
  trusts: TrustRecord[];
  priorYearAdjustedGrossIncome: number;
  priorYearTaxableGiftsReported: number;
  lifetimeExclusionPreviouslyUsed: number;
  advisorNotes: string[];
}
