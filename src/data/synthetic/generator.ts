import { Rng } from './random';
import { getTaxYear } from '@/lib/tax-year';
import type {
  Client,
  ClientArchetype,
  Dependent,
  FilingStatus,
  ForeignAccount,
  ForeignAccountType,
  Gift,
  GiftAssetType,
  ResidencyProfile,
  TrustKind,
  TrustRecord,
} from '@/lib/types';

/**
 * Synthetic cohort generator. Everything it produces is invented: the name
 * pools below are constructed from generic syllables and place names so a
 * generated record cannot collide with a real person by design.
 */

const GIVEN_NAMES = [
  'Alina', 'Bertram', 'Cassia', 'Dorian', 'Elowen', 'Ferris', 'Giselle', 'Halvard',
  'Imara', 'Jarrah', 'Kestrel', 'Lucian', 'Marisol', 'Nadim', 'Odalys', 'Perrin',
  'Quintus', 'Rosalind', 'Soren', 'Thandiwe', 'Ulric', 'Vesna', 'Wendeline', 'Xiomara',
  'Yannick', 'Zenobia',
];

const FAMILY_NAMES = [
  'Ashgrove', 'Bellweather', 'Cravensworth', 'Duplessis', 'Eastmarch', 'Fairholt',
  'Gainsborough', 'Harrowgate', 'Illingworth', 'Jessamy', 'Kirkbride', 'Lindenmayer',
  'Merriwether', 'Northcott', 'Oakhampton', 'Pemberton', 'Quillfeather', 'Ravenscroft',
  'Stanbury', 'Thornleigh', 'Underhill', 'Vandeleur', 'Wexley', 'Yarborough',
];

const STATES: ResidencyProfile[] = [
  { stateCode: 'CA', stateName: 'California', topMarginalStateRate: 0.133, residencyNote: 'Full-year resident.', livesAbroad: false },
  { stateCode: 'NY', stateName: 'New York', topMarginalStateRate: 0.109, residencyNote: 'Full-year resident.', livesAbroad: false },
  { stateCode: 'TX', stateName: 'Texas', topMarginalStateRate: 0, residencyNote: 'No individual income tax.', livesAbroad: false },
  { stateCode: 'FL', stateName: 'Florida', topMarginalStateRate: 0, residencyNote: 'No individual income tax.', livesAbroad: false },
  { stateCode: 'IL', stateName: 'Illinois', topMarginalStateRate: 0.0495, residencyNote: 'Full-year resident.', livesAbroad: false },
  { stateCode: 'MA', stateName: 'Massachusetts', topMarginalStateRate: 0.09, residencyNote: 'Full-year resident; surtax rate applied.', livesAbroad: false },
  { stateCode: 'WA', stateName: 'Washington', topMarginalStateRate: 0, residencyNote: 'No individual income tax on wages.', livesAbroad: false },
  { stateCode: 'CT', stateName: 'Connecticut', topMarginalStateRate: 0.0699, residencyNote: 'Full-year resident.', livesAbroad: false },
];

const FOREIGN_COUNTRIES = [
  { country: 'United Kingdom', currency: 'GBP', institution: 'Thameside Private Bank' },
  { country: 'Switzerland', currency: 'CHF', institution: 'Aarwald Kantonalbank' },
  { country: 'Singapore', currency: 'SGD', institution: 'Straits Meridian Bank' },
  { country: 'Canada', currency: 'CAD', institution: 'Laurentide Trust' },
  { country: 'Australia', currency: 'AUD', institution: 'Kembla Commonwealth Bank' },
  { country: 'Germany', currency: 'EUR', institution: 'Rheinhardt Privatbank' },
  { country: 'Japan', currency: 'JPY', institution: 'Kitagawa Shinkin Bank' },
  { country: 'Ireland', currency: 'EUR', institution: 'Clonmara Savings' },
];

const ACCOUNT_TYPES: ForeignAccountType[] = [
  'depository',
  'custodial',
  'brokerage',
  'pooledInvestmentFund',
  'pension',
];

const TRUST_KINDS: TrustKind[] = [
  'grantorRevocable',
  'irrevocableNonGrantor',
  'irrevocableGrantor',
  'charitableRemainderUnitrust',
];

const FILING_STATUSES: FilingStatus[] = [
  'single',
  'marriedFilingJointly',
  'marriedFilingSeparately',
  'headOfHousehold',
];

const ARCHETYPES: Array<{ key: ClientArchetype; label: string; occupation: string; employer: string }> = [
  {
    key: 'corporateExecutive',
    label: 'Corporate executive',
    occupation: 'Senior Vice President',
    employer: 'Ardennes Holdings Group',
  },
  {
    key: 'businessOwner',
    label: 'Business owner',
    occupation: 'Founder and Managing Member',
    employer: 'Whitmoor Industrial Partners, LLC',
  },
  {
    key: 'internationalExecutive',
    label: 'International executive',
    occupation: 'Regional Director',
    employer: 'Calloway Brandt International',
  },
];

const GIFT_ASSETS: GiftAssetType[] = [
  'cash',
  'marketableSecurities',
  'realProperty',
  'closelyHeldBusinessInterest',
];

export interface GeneratorOptions {
  count: number;
  seed: number;
  taxYear: number;
}

export const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  count: 100,
  seed: 20250101,
  taxYear: 2025,
};

function makeName(rng: Rng): string {
  return `${rng.pick(GIVEN_NAMES)} ${rng.pick(FAMILY_NAMES)}`;
}

function makeDependents(rng: Rng, count: number, surname: string): Dependent[] {
  return Array.from({ length: count }, () => {
    const age = rng.int(2, 24);
    return {
      name: `${rng.pick(GIVEN_NAMES)} ${surname}`,
      relationship: rng.bool() ? 'Daughter' : 'Son',
      age,
      inCollege: age >= 18 && age <= 23,
    };
  });
}

function makeGifts(rng: Rng, index: number, annualExclusion: number, spouseIsCitizen: boolean): Gift[] {
  const doneeCount = rng.int(0, 5);
  const gifts: Gift[] = [];

  for (let i = 0; i < doneeCount; i += 1) {
    // A third of donees sit deliberately at or just below the exclusion so the
    // cohort exercises the negative branch of the annual exclusion rule.
    const band = rng.float();
    const amount =
      band < 0.3
        ? rng.money(1_000, annualExclusion, 1_000)
        : band < 0.4
          ? annualExclusion
          : rng.money(annualExclusion + 1_000, annualExclusion * 12, 1_000);
    const assetType = rng.pick(GIFT_ASSETS);
    const intoTrust = rng.bool(0.2);
    gifts.push({
      id: `syn-${index}-gift-${i}`,
      recipient: `${makeName(rng)}${intoTrust ? ' Trust' : ''}`,
      relationship: rng.pick(['Son', 'Daughter', 'Grandson', 'Granddaughter', 'Nephew', 'Niece', 'Irrevocable trust for descendants']),
      amount,
      assetType,
      presentInterest: !intoTrust,
      intoTrust,
      crummeyWithdrawalRight: intoTrust && rng.bool(0.6),
      spouseElectsGiftSplitting: spouseIsCitizen && rng.bool(0.3),
      recipientIsSpouse: false,
      recipientIsUSCitizen: true,
      costBasis: assetType === 'cash' ? undefined : Math.round(amount * rng.float(0.15, 0.85)),
    });
  }

  if (!spouseIsCitizen && rng.bool(0.6)) {
    gifts.push({
      id: `syn-${index}-gift-spouse`,
      recipient: makeName(rng),
      relationship: 'Spouse (non-U.S. citizen)',
      amount: rng.money(50_000, 400_000, 5_000),
      assetType: 'marketableSecurities',
      presentInterest: true,
      intoTrust: false,
      crummeyWithdrawalRight: false,
      spouseElectsGiftSplitting: false,
      recipientIsSpouse: true,
      recipientIsUSCitizen: false,
      costBasis: rng.money(20_000, 200_000, 5_000),
    });
  }

  return gifts;
}

function makeForeignAccounts(rng: Rng, index: number, fbarThreshold: number): ForeignAccount[] {
  const band = rng.float();
  // 30% of the cohort has no foreign accounts, 15% sits below the aggregate
  // threshold, and the remainder crosses it by varying margins.
  if (band < 0.3) return [];

  const count = band < 0.45 ? 1 : rng.int(1, 5);
  const ceiling = band < 0.45 ? fbarThreshold / count : rng.money(20_000, 2_400_000, 5_000);

  return Array.from({ length: count }, (_, i) => {
    const place = rng.pick(FOREIGN_COUNTRIES);
    const maximumValueUSD = Math.max(500, rng.money(500, ceiling, 100));
    const accountType = rng.pick(ACCOUNT_TYPES);
    return {
      id: `syn-${index}-fa-${i}`,
      institution: place.institution,
      country: place.country,
      accountType,
      maximumValueUSD,
      yearEndValueUSD: Math.round(maximumValueUSD * rng.float(0.55, 0.99)),
      localCurrency: place.currency,
      interestType: rng.bool(0.15) ? 'signatureAuthorityOnly' : rng.bool(0.3) ? 'jointOwner' : 'ownerOfRecord',
      isEmployerPlan: accountType === 'pension',
      openedYear: rng.int(2004, 2025),
    } satisfies ForeignAccount;
  });
}

function makeTrusts(rng: Rng, index: number, clientName: string): TrustRecord[] {
  const count = rng.int(0, 3);
  return Array.from({ length: count }, (_, i) => {
    const kind = rng.pick(TRUST_KINDS);
    const interest = rng.money(0, 90_000, 500);
    const dividends = rng.money(0, 160_000, 500);
    const capitalGains = rng.money(0, 600_000, 500);
    const rental = rng.bool(0.35) ? rng.money(0, 260_000, 500) : 0;
    const other = rng.bool(0.2) ? rng.money(0, 40_000, 500) : 0;
    const gross = interest + dividends + capitalGains + rental + other;
    return {
      id: `syn-${index}-trust-${i}`,
      name: `${clientName.split(' ').at(-1)} ${rng.pick(['Family', 'Descendants', 'Legacy', 'Heritage'])} Trust (${rng.int(2004, 2023)})`,
      kind,
      situs: rng.pick(['Delaware', 'Nevada', 'South Dakota', 'Alaska', 'Wyoming', 'New Hampshire']),
      yearEstablished: rng.int(2004, 2023),
      grantor: clientName,
      trustee: rng.pick(['Cedar Bluff Fiduciary Services', 'Brandywine Trust Partners', 'Sierra Peak Trust Company']),
      beneficiaries: Array.from({ length: rng.int(1, 3) }, () => makeName(rng)),
      principalValue: rng.money(500_000, 18_000_000, 50_000),
      income: { interest, dividends, capitalGains, rental, other },
      distributionsToBeneficiaries: Math.round(gross * rng.float(0, 0.9)),
      capitalGainsAllocatedToIncome: rng.bool(0.25),
      fiduciaryFees: rng.money(0, 60_000, 1_000),
      stateAndLocalTaxes: rng.money(0, 30_000, 1_000),
      hasNonresidentAlienBeneficiary: rng.bool(0.12),
      isForeignTrust: rng.bool(0.08),
    } satisfies TrustRecord;
  });
}

export function generateClient(index: number, options: GeneratorOptions): Client {
  const rng = new Rng(options.seed + index * 7919);
  const constants = getTaxYear(options.taxYear);
  const archetype = ARCHETYPES[index % ARCHETYPES.length]!;
  const displayName = makeName(rng);
  const surname = displayName.split(' ')[1] ?? 'Ashgrove';
  const filingStatus = rng.pick(FILING_STATUSES);
  const married =
    filingStatus === 'marriedFilingJointly' || filingStatus === 'marriedFilingSeparately';
  const international = archetype.key === 'internationalExecutive';
  const spouseIsUSCitizen = married ? !(international && rng.bool(0.5)) : true;

  const residency: ResidencyProfile = international && rng.bool(0.5)
    ? {
        ...rng.pick(STATES),
        residencyNote: 'Resident abroad; domicile and statutory residency are open items.',
        livesAbroad: true,
        countryOfResidence: rng.pick(FOREIGN_COUNTRIES).country,
        topMarginalStateRate: 0,
      }
    : rng.pick(STATES);

  const scale = rng.float(0.4, 2.4);
  const businessHeavy = archetype.key === 'businessOwner';

  const wages = businessHeavy ? rng.money(150_000, 600_000, 10_000) : Math.round(rng.money(400_000, 1_600_000, 10_000) * scale);
  const bonus = businessHeavy ? 0 : Math.round(rng.money(0, 900_000, 10_000) * scale);
  const equityCompensation = businessHeavy ? 0 : Math.round(rng.money(0, 2_600_000, 10_000) * scale);
  const businessIncome = businessHeavy ? Math.round(rng.money(600_000, 4_500_000, 10_000) * scale) : 0;
  const longTermCapitalGain = rng.money(0, 2_400_000, 5_000);
  const marketablePortfolio = rng.money(2_000_000, 32_000_000, 100_000);

  return {
    id: `synthetic-${String(index + 1).padStart(3, '0')}`,
    displayName,
    archetype: archetype.key,
    archetypeLabel: archetype.label,
    engagementRef: `SYN-${options.taxYear}-${String(index + 1).padStart(3, '0')}`,
    taxYear: options.taxYear,
    age: rng.int(38, 72),
    spouseName: married ? `${rng.pick(GIVEN_NAMES)} ${surname}` : undefined,
    spouseAge: married ? rng.int(36, 70) : undefined,
    spouseIsUSCitizen,
    filingStatus,
    residency,
    occupation: archetype.occupation,
    employer: archetype.employer,
    dependents: makeDependents(rng, rng.int(0, 3), surname),
    income: {
      wages,
      bonus,
      equityCompensation,
      taxableInterest: rng.money(0, 260_000, 1_000),
      taxExemptInterest: rng.bool(0.4) ? rng.money(0, 220_000, 1_000) : 0,
      qualifiedDividends: rng.money(0, 420_000, 1_000),
      nonQualifiedDividends: rng.money(0, 120_000, 1_000),
      shortTermCapitalGain: rng.bool(0.5) ? rng.money(0, 300_000, 5_000) : 0,
      longTermCapitalGain,
      businessIncome,
      rentalIncome: rng.bool(0.5) ? rng.money(0, 620_000, 5_000) : 0,
      trustDistributions: rng.bool(0.35) ? rng.money(0, 400_000, 5_000) : 0,
      retirementDistributions: rng.bool(0.2) ? rng.money(0, 300_000, 5_000) : 0,
      otherIncome: rng.bool(0.3) ? rng.money(0, 90_000, 1_000) : 0,
    },
    deductions: {
      charitableCash: rng.money(0, 700_000, 5_000),
      charitableAppreciatedSecurities: rng.bool(0.45) ? rng.money(0, 1_400_000, 10_000) : 0,
      charitablePrivateFoundation: rng.bool(0.2) ? rng.money(0, 900_000, 10_000) : 0,
      stateAndLocalTaxesPaid: Math.round(
        rng.money(20_000, 900_000, 1_000) * (residency.topMarginalStateRate > 0 ? 1 : 0.15),
      ),
      mortgageInterest: rng.money(0, 120_000, 1_000),
      medicalExpenses: rng.money(0, 90_000, 1_000),
      investmentInterestExpense: rng.bool(0.25) ? rng.money(0, 80_000, 1_000) : 0,
      charitableCarryforward: rng.bool(0.3) ? rng.money(0, 500_000, 10_000) : 0,
    },
    balanceSheet: {
      cashAndEquivalents: rng.money(200_000, 5_000_000, 50_000),
      marketablePortfolio,
      concentratedPositions: rng.bool(0.45)
        ? [
            {
              label: `${archetype.employer} common stock`,
              marketValue: rng.money(1_000_000, 14_000_000, 100_000),
              costBasis: rng.money(200_000, 3_000_000, 50_000),
              acquiredVia: 'Long-term incentive plan awards and option exercises',
            },
          ]
        : [],
      privateBusinessInterests: businessHeavy ? rng.money(6_000_000, 70_000_000, 500_000) : 0,
      retirementAccounts: rng.money(500_000, 9_000_000, 100_000),
      realEstate: [
        {
          label: 'Primary residence',
          location: `${residency.stateName}`,
          use: 'primaryResidence',
          marketValue: rng.money(900_000, 9_000_000, 50_000),
          costBasis: rng.money(400_000, 4_000_000, 50_000),
          mortgageBalance: rng.bool(0.6) ? rng.money(0, 3_000_000, 50_000) : 0,
        },
      ],
      otherLiabilities: rng.money(0, 3_000_000, 50_000),
    },
    gifts: makeGifts(rng, index, constants.wealthTransfer.annualGiftExclusion, spouseIsUSCitizen),
    foreignAccounts: international || rng.bool(0.35)
      ? makeForeignAccounts(rng, index, constants.foreignReporting.fbarAggregateThreshold)
      : [],
    foreignEntities:
      international && rng.bool(0.5)
        ? [
            {
              id: `syn-${index}-fe-0`,
              name: `${surname} Holdings Limited`,
              country: rng.pick(FOREIGN_COUNTRIES).country,
              kind: rng.pick(['foreignCorporation', 'passiveForeignInvestmentCompany'] as const),
              ownershipPercent: rng.float(0.02, 0.9),
              valueUSD: rng.money(200_000, 8_000_000, 50_000),
            },
          ]
        : [],
    trusts: makeTrusts(rng, index, displayName),
    priorYearAdjustedGrossIncome: rng.money(120_000, 6_000_000, 10_000),
    priorYearTaxableGiftsReported: rng.bool(0.4) ? rng.money(0, 3_000_000, 10_000) : 0,
    lifetimeExclusionPreviouslyUsed: rng.bool(0.5) ? rng.money(0, 12_000_000, 50_000) : 0,
    advisorNotes: ['Synthetic record generated for regression testing. Not a real engagement.'],
  };
}

export function generateCohort(
  options: Partial<GeneratorOptions> = {},
): Client[] {
  const resolved = { ...DEFAULT_GENERATOR_OPTIONS, ...options };
  return Array.from({ length: resolved.count }, (_, index) => generateClient(index, resolved));
}
