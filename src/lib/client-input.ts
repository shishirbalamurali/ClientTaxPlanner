import { SUPPORTED_TAX_YEARS, DEFAULT_TAX_YEAR } from '@/lib/tax-year';
import type {
  BalanceSheet,
  Client,
  DeductionProfile,
  FilingStatus,
  ForeignAccount,
  Gift,
  IncomeProfile,
  TrustRecord,
} from '@/lib/types';

/**
 * Turns pasted JSON into a Client, or into error messages a non-programmer can
 * act on. Deliberately forgiving: anything omitted takes a sensible default, so
 * a useful record can be four lines rather than two hundred. The cost of that
 * is that every field has to be range-checked here rather than trusted.
 */

export type ParseResult =
  | { ok: true; client: Client; warnings: string[] }
  | { ok: false; errors: string[] };

const FILING_STATUSES: FilingStatus[] = [
  'single',
  'marriedFilingJointly',
  'marriedFilingSeparately',
  'headOfHousehold',
  'qualifyingSurvivingSpouse',
];

const EMPTY_INCOME: IncomeProfile = {
  wages: 0,
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
};

const EMPTY_DEDUCTIONS: DeductionProfile = {
  charitableCash: 0,
  charitableAppreciatedSecurities: 0,
  charitablePrivateFoundation: 0,
  stateAndLocalTaxesPaid: 0,
  mortgageInterest: 0,
  medicalExpenses: 0,
  investmentInterestExpense: 0,
  charitableCarryforward: 0,
};

const EMPTY_BALANCE_SHEET: BalanceSheet = {
  cashAndEquivalents: 0,
  marketablePortfolio: 0,
  concentratedPositions: [],
  privateBusinessInterests: 0,
  retirementAccounts: 0,
  realEstate: [],
  otherLiabilities: 0,
};

class Problems {
  readonly errors: string[] = [];
  readonly warnings: string[] = [];

  error(path: string, message: string) {
    this.errors.push(`${path} — ${message}`);
  }

  warn(message: string) {
    this.warnings.push(message);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Accepts 30000, "30000", "$30,000" and "30,000" — all common ways to paste a figure. */
function money(value: unknown, path: string, p: Problems, fallback = 0): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      p.error(path, 'must be a finite number.');
      return fallback;
    }
    return value;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s]/g, '');
    const parsed = Number(cleaned);
    if (cleaned !== '' && Number.isFinite(parsed)) return parsed;
    p.error(path, `expected a number, got ${JSON.stringify(value)}.`);
    return fallback;
  }
  p.error(path, `expected a number, got ${typeof value}.`);
  return fallback;
}

/** Interfaces have no index signature, so the indexing is done behind a cast. */
function numberBlock<T extends object>(raw: unknown, defaults: T, path: string, p: Problems): T {
  if (raw === undefined) return { ...defaults };
  if (!isObject(raw)) {
    p.error(path, 'expected an object of named amounts.');
    return { ...defaults };
  }
  const out = { ...defaults } as Record<string, unknown>;
  for (const [key, value] of Object.entries(raw)) {
    if (!(key in defaults)) {
      p.warn(`${path}.${key} is not a field the model uses, so it was ignored.`);
      continue;
    }
    out[key] = money(value, `${path}.${key}`, p);
  }
  return out as T;
}

function text(value: unknown, path: string, p: Problems, fallback: string): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  p.error(path, 'expected some text.');
  return fallback;
}

function parseGifts(raw: unknown, p: Problems): Gift[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    p.error('gifts', 'expected a list, written with square brackets.');
    return [];
  }
  return raw.flatMap((entry, i) => {
    const path = `gifts[${i}]`;
    if (!isObject(entry)) {
      p.error(path, 'expected an object with at least a recipient and an amount.');
      return [];
    }
    const recipient = text(entry.recipient, `${path}.recipient`, p, '');
    if (!recipient) {
      p.error(path, 'needs a "recipient".');
      return [];
    }
    const intoTrust = entry.intoTrust === true;
    return [
      {
        id: text(entry.id, `${path}.id`, p, `gift-${i + 1}`),
        recipient,
        relationship: text(entry.relationship, `${path}.relationship`, p, 'Not stated'),
        amount: money(entry.amount, `${path}.amount`, p),
        assetType: (['cash', 'marketableSecurities', 'realProperty', 'closelyHeldBusinessInterest'] as const).includes(
          entry.assetType as never,
        )
          ? (entry.assetType as Gift['assetType'])
          : 'cash',
        presentInterest: entry.presentInterest === undefined ? !intoTrust : entry.presentInterest === true,
        intoTrust,
        crummeyWithdrawalRight: entry.crummeyWithdrawalRight === true,
        spouseElectsGiftSplitting: entry.spouseElectsGiftSplitting === true,
        recipientIsSpouse: entry.recipientIsSpouse === true,
        recipientIsUSCitizen: entry.recipientIsUSCitizen !== false,
        costBasis:
          entry.costBasis === undefined ? undefined : money(entry.costBasis, `${path}.costBasis`, p),
        note: entry.note === undefined ? undefined : text(entry.note, `${path}.note`, p, ''),
      },
    ];
  });
}

function parseForeignAccounts(raw: unknown, p: Problems): ForeignAccount[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    p.error('foreignAccounts', 'expected a list, written with square brackets.');
    return [];
  }
  return raw.flatMap((entry, i) => {
    const path = `foreignAccounts[${i}]`;
    if (!isObject(entry)) {
      p.error(path, 'expected an object with at least an institution and a maximum value.');
      return [];
    }
    const maximumValueUSD = money(entry.maximumValueUSD, `${path}.maximumValueUSD`, p);
    return [
      {
        id: text(entry.id, `${path}.id`, p, `account-${i + 1}`),
        institution: text(entry.institution, `${path}.institution`, p, `Account ${i + 1}`),
        country: text(entry.country, `${path}.country`, p, 'Not stated'),
        accountType: (['depository', 'custodial', 'brokerage', 'pooledInvestmentFund', 'insuranceOrAnnuity', 'pension'] as const).includes(
          entry.accountType as never,
        )
          ? (entry.accountType as ForeignAccount['accountType'])
          : 'depository',
        maximumValueUSD,
        yearEndValueUSD:
          entry.yearEndValueUSD === undefined
            ? maximumValueUSD
            : money(entry.yearEndValueUSD, `${path}.yearEndValueUSD`, p),
        localCurrency: text(entry.localCurrency, `${path}.localCurrency`, p, 'USD'),
        interestType: (['ownerOfRecord', 'jointOwner', 'signatureAuthorityOnly'] as const).includes(
          entry.interestType as never,
        )
          ? (entry.interestType as ForeignAccount['interestType'])
          : 'ownerOfRecord',
        isEmployerPlan: entry.isEmployerPlan === true,
        openedYear: Math.round(money(entry.openedYear, `${path}.openedYear`, p, DEFAULT_TAX_YEAR)),
      },
    ];
  });
}

function parseTrusts(raw: unknown, p: Problems): TrustRecord[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    p.error('trusts', 'expected a list, written with square brackets.');
    return [];
  }
  return raw.flatMap((entry, i) => {
    const path = `trusts[${i}]`;
    if (!isObject(entry)) {
      p.error(path, 'expected an object with at least a name.');
      return [];
    }
    const income = numberBlock(
      entry.income,
      { interest: 0, dividends: 0, capitalGains: 0, rental: 0, other: 0 },
      `${path}.income`,
      p,
    );
    return [
      {
        id: text(entry.id, `${path}.id`, p, `trust-${i + 1}`),
        name: text(entry.name, `${path}.name`, p, `Trust ${i + 1}`),
        kind: (['grantorRevocable', 'irrevocableNonGrantor', 'irrevocableGrantor', 'charitableRemainderUnitrust'] as const).includes(
          entry.kind as never,
        )
          ? (entry.kind as TrustRecord['kind'])
          : 'irrevocableNonGrantor',
        situs: text(entry.situs, `${path}.situs`, p, 'Not stated'),
        yearEstablished: Math.round(
          money(entry.yearEstablished, `${path}.yearEstablished`, p, DEFAULT_TAX_YEAR),
        ),
        grantor: text(entry.grantor, `${path}.grantor`, p, 'Not stated'),
        trustee: text(entry.trustee, `${path}.trustee`, p, 'Not stated'),
        beneficiaries: Array.isArray(entry.beneficiaries)
          ? entry.beneficiaries.map((b, j) => text(b, `${path}.beneficiaries[${j}]`, p, 'Not stated'))
          : [],
        principalValue: money(entry.principalValue, `${path}.principalValue`, p),
        income,
        distributionsToBeneficiaries: money(
          entry.distributionsToBeneficiaries,
          `${path}.distributionsToBeneficiaries`,
          p,
        ),
        capitalGainsAllocatedToIncome: entry.capitalGainsAllocatedToIncome === true,
        fiduciaryFees: money(entry.fiduciaryFees, `${path}.fiduciaryFees`, p),
        stateAndLocalTaxes: money(entry.stateAndLocalTaxes, `${path}.stateAndLocalTaxes`, p),
        hasNonresidentAlienBeneficiary: entry.hasNonresidentAlienBeneficiary === true,
        isForeignTrust: entry.isForeignTrust === true,
      },
    ];
  });
}

export function parseClientInput(input: string): ParseResult {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { ok: false, errors: ['Nothing to read — paste a client record first.'] };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      errors: [
        `That is not valid JSON. ${detail}`,
        'Common causes: a trailing comma after the last item, a missing closing brace, or curly “smart quotes” pasted from a word processor instead of straight ones.',
      ],
    };
  }

  if (!isObject(raw)) {
    return {
      ok: false,
      errors: ['The record must be a single object, starting with { and ending with }.'],
    };
  }

  const p = new Problems();

  const filingStatusRaw = raw.filingStatus;
  let filingStatus: FilingStatus = 'marriedFilingJointly';
  if (filingStatusRaw === undefined) {
    p.warn('No "filingStatus" given; married filing jointly was assumed.');
  } else if (FILING_STATUSES.includes(filingStatusRaw as FilingStatus)) {
    filingStatus = filingStatusRaw as FilingStatus;
  } else {
    p.error(
      'filingStatus',
      `must be one of ${FILING_STATUSES.map((s) => `"${s}"`).join(', ')}.`,
    );
  }

  const taxYear = Math.round(money(raw.taxYear, 'taxYear', p, DEFAULT_TAX_YEAR));
  if (!SUPPORTED_TAX_YEARS.includes(taxYear)) {
    p.error('taxYear', `only ${SUPPORTED_TAX_YEARS.join(', ')} is modeled at the moment.`);
  }

  const residencyRaw = isObject(raw.residency) ? raw.residency : {};
  const client: Client = {
    id: 'loaded-client',
    displayName: text(raw.displayName, 'displayName', p, 'Loaded client'),
    archetype: 'corporateExecutive',
    archetypeLabel: text(raw.archetypeLabel, 'archetypeLabel', p, 'Loaded record'),
    engagementRef: text(raw.engagementRef, 'engagementRef', p, 'WORKSPACE'),
    taxYear,
    age: Math.round(money(raw.age, 'age', p, 50)),
    spouseName: raw.spouseName === undefined ? undefined : text(raw.spouseName, 'spouseName', p, ''),
    spouseAge: raw.spouseAge === undefined ? undefined : Math.round(money(raw.spouseAge, 'spouseAge', p, 50)),
    spouseIsUSCitizen: raw.spouseIsUSCitizen !== false,
    filingStatus,
    residency: {
      stateCode: text(residencyRaw.stateCode, 'residency.stateCode', p, 'NA'),
      stateName: text(residencyRaw.stateName, 'residency.stateName', p, 'Not stated'),
      topMarginalStateRate: money(
        residencyRaw.topMarginalStateRate,
        'residency.topMarginalStateRate',
        p,
      ),
      residencyNote: text(residencyRaw.residencyNote, 'residency.residencyNote', p, 'No residency note supplied.'),
      livesAbroad: residencyRaw.livesAbroad === true,
      countryOfResidence:
        residencyRaw.countryOfResidence === undefined
          ? undefined
          : text(residencyRaw.countryOfResidence, 'residency.countryOfResidence', p, ''),
    },
    occupation: text(raw.occupation, 'occupation', p, 'Not stated'),
    employer: text(raw.employer, 'employer', p, 'Not stated'),
    dependents: Array.isArray(raw.dependents)
      ? raw.dependents.flatMap((d, i) =>
          isObject(d)
            ? [
                {
                  name: text(d.name, `dependents[${i}].name`, p, `Dependent ${i + 1}`),
                  relationship: text(d.relationship, `dependents[${i}].relationship`, p, 'Not stated'),
                  age: Math.round(money(d.age, `dependents[${i}].age`, p)),
                  inCollege: d.inCollege === true,
                },
              ]
            : [],
        )
      : [],
    income: numberBlock(raw.income, EMPTY_INCOME, 'income', p),
    deductions: numberBlock(raw.deductions, EMPTY_DEDUCTIONS, 'deductions', p),
    balanceSheet: {
      ...EMPTY_BALANCE_SHEET,
      ...numberBlock(
        isObject(raw.balanceSheet)
          ? Object.fromEntries(
              Object.entries(raw.balanceSheet).filter(
                ([k]) => k !== 'concentratedPositions' && k !== 'realEstate',
              ),
            )
          : undefined,
        {
          cashAndEquivalents: 0,
          marketablePortfolio: 0,
          privateBusinessInterests: 0,
          retirementAccounts: 0,
          otherLiabilities: 0,
        },
        'balanceSheet',
        p,
      ),
    },
    gifts: parseGifts(raw.gifts, p),
    foreignAccounts: parseForeignAccounts(raw.foreignAccounts, p),
    foreignEntities: [],
    trusts: parseTrusts(raw.trusts, p),
    priorYearAdjustedGrossIncome: money(
      raw.priorYearAdjustedGrossIncome,
      'priorYearAdjustedGrossIncome',
      p,
    ),
    priorYearTaxableGiftsReported: money(
      raw.priorYearTaxableGiftsReported,
      'priorYearTaxableGiftsReported',
      p,
    ),
    lifetimeExclusionPreviouslyUsed: money(
      raw.lifetimeExclusionPreviouslyUsed,
      'lifetimeExclusionPreviouslyUsed',
      p,
    ),
    advisorNotes: Array.isArray(raw.advisorNotes)
      ? raw.advisorNotes.map((n, i) => text(n, `advisorNotes[${i}]`, p, ''))
      : [],
  };

  if (p.errors.length > 0) return { ok: false, errors: p.errors };
  return { ok: true, client, warnings: p.warnings };
}

/** A short, valid record used by the "load an example" button. */
export const EXAMPLE_CLIENT_JSON = `{
  "displayName": "Alex Rivera",
  "occupation": "Physician, private practice",
  "filingStatus": "marriedFilingJointly",
  "age": 58,
  "spouseName": "Jordan Rivera",
  "residency": {
    "stateCode": "NJ",
    "stateName": "New Jersey",
    "topMarginalStateRate": 0.1075,
    "residencyNote": "Full-year resident."
  },
  "income": {
    "wages": 780000,
    "businessIncome": 1100000,
    "taxableInterest": 42000,
    "qualifiedDividends": 96000,
    "longTermCapitalGain": 240000
  },
  "deductions": {
    "charitableCash": 120000,
    "stateAndLocalTaxesPaid": 190000,
    "mortgageInterest": 38000
  },
  "priorYearAdjustedGrossIncome": 1850000,
  "gifts": [
    { "recipient": "Sam Rivera", "relationship": "Daughter", "amount": 19000 },
    { "recipient": "Noor Rivera", "relationship": "Son", "amount": 44000 }
  ],
  "foreignAccounts": [
    { "institution": "Banco Santander", "country": "Spain", "maximumValueUSD": 8400 },
    { "institution": "HSBC", "country": "United Kingdom", "maximumValueUSD": 5100 }
  ],
  "trusts": [
    {
      "name": "Rivera Family Trust",
      "kind": "irrevocableNonGrantor",
      "situs": "Delaware",
      "principalValue": 2400000,
      "income": { "interest": 28000, "dividends": 61000, "capitalGains": 140000 },
      "distributionsToBeneficiaries": 30000
    }
  ]
}`;
