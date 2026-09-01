import { describe, expect, it } from 'vitest';
import { analyzeForeignAccounts } from '@/lib/analysis/foreign';
import { evaluateClient } from '@/lib/rules';
import { TAX_YEAR_2025 } from '@/lib/tax-year';
import { findingIds, makeClient, makeForeignAccount } from './factories';

const FBAR_THRESHOLD = TAX_YEAR_2025.foreignReporting.fbarAggregateThreshold;

describe('FBAR aggregate threshold', () => {
  it('raises no flag when no foreign accounts are recorded', () => {
    const client = makeClient({ foreignAccounts: [] });
    const analysis = analyzeForeignAccounts(client, TAX_YEAR_2025);

    expect(analysis.accountCount).toBe(0);
    expect(analysis.aggregateMaximumValue).toBe(0);
    expect(analysis.fbarReviewFlag).toBe(false);
    expect(findingIds(evaluateClient(client).findings)).not.toContain('FBAR-AGGREGATE');
  });

  it('raises no flag for a single account below the threshold', () => {
    const client = makeClient({
      foreignAccounts: [makeForeignAccount({ maximumValueUSD: FBAR_THRESHOLD - 1 })],
    });
    const analysis = analyzeForeignAccounts(client, TAX_YEAR_2025);

    expect(analysis.fbarReviewFlag).toBe(false);
    expect(analysis.fbarHeadroom).toBe(1);
    expect(findingIds(evaluateClient(client).findings)).not.toContain('FBAR-AGGREGATE');
  });

  it('does not flag an aggregate exactly at the threshold', () => {
    const client = makeClient({
      foreignAccounts: [makeForeignAccount({ maximumValueUSD: FBAR_THRESHOLD })],
    });
    // The regulation tests whether the aggregate exceeds $10,000, not whether it reaches it.
    expect(analyzeForeignAccounts(client, TAX_YEAR_2025).fbarReviewFlag).toBe(false);
  });

  it('flags an aggregate one dollar above the threshold', () => {
    const client = makeClient({
      foreignAccounts: [makeForeignAccount({ maximumValueUSD: FBAR_THRESHOLD + 1 })],
    });
    const analysis = analyzeForeignAccounts(client, TAX_YEAR_2025);

    expect(analysis.fbarReviewFlag).toBe(true);
    expect(findingIds(evaluateClient(client).findings)).toContain('FBAR-AGGREGATE');
  });
});

describe('multiple foreign accounts', () => {
  const accounts = [
    makeForeignAccount({ id: 'a', institution: 'Bank A', country: 'France', maximumValueUSD: 4_000 }),
    makeForeignAccount({ id: 'b', institution: 'Bank B', country: 'France', maximumValueUSD: 3_500 }),
    makeForeignAccount({ id: 'c', institution: 'Bank C', country: 'Japan', maximumValueUSD: 3_000 }),
  ];

  it('aggregates across accounts even though each is below the threshold', () => {
    const client = makeClient({ foreignAccounts: accounts });
    const analysis = analyzeForeignAccounts(client, TAX_YEAR_2025);

    expect(analysis.accountCount).toBe(3);
    expect(analysis.aggregateMaximumValue).toBe(10_500);
    expect(analysis.largestAccountValue).toBe(4_000);
    expect(analysis.fbarReviewFlag).toBe(true);
  });

  it('groups exposure by country, largest first', () => {
    const analysis = analyzeForeignAccounts(
      makeClient({ foreignAccounts: accounts }),
      TAX_YEAR_2025,
    );

    expect(analysis.countries).toHaveLength(2);
    expect(analysis.countries[0]).toMatchObject({
      country: 'France',
      accountCount: 2,
      maximumValueUSD: 7_500,
    });
    expect(analysis.countries[1]?.country).toBe('Japan');
  });

  it('tracks signature-authority accounts separately from the owned aggregate', () => {
    const client = makeClient({
      foreignAccounts: [
        makeForeignAccount({ id: 'owned', maximumValueUSD: 60_000 }),
        makeForeignAccount({
          id: 'sig',
          institution: 'Employer Operating Account',
          maximumValueUSD: 900_000,
          interestType: 'signatureAuthorityOnly',
        }),
      ],
    });
    const analysis = analyzeForeignAccounts(client, TAX_YEAR_2025);

    expect(analysis.aggregateMaximumValue).toBe(960_000);
    expect(analysis.aggregateMaximumExcludingSignatureAuthority).toBe(60_000);
    expect(analysis.signatureAuthorityOnlyCount).toBe(1);
    expect(findingIds(evaluateClient(client).findings)).toContain('FBAR-SIGNATURE-AUTHORITY');
  });
});

describe('Form 8938 thresholds', () => {
  const thresholds = TAX_YEAR_2025.foreignReporting.form8938;

  it('applies the domestic joint threshold and does not flag below it', () => {
    const client = makeClient({
      filingStatus: 'marriedFilingJointly',
      foreignAccounts: [
        makeForeignAccount({ maximumValueUSD: 90_000, yearEndValueUSD: 80_000 }),
      ],
    });
    const analysis = analyzeForeignAccounts(client, TAX_YEAR_2025);

    expect(analysis.form8938YearEndThreshold).toBe(
      thresholds.livingInUS.marriedFilingJointly.yearEnd,
    );
    expect(analysis.form8938ReviewFlag).toBe(false);
  });

  it('flags on the any-time test even where the year-end value is below the threshold', () => {
    const client = makeClient({
      filingStatus: 'marriedFilingJointly',
      foreignAccounts: [
        makeForeignAccount({ maximumValueUSD: 160_000, yearEndValueUSD: 20_000 }),
      ],
    });
    const analysis = analyzeForeignAccounts(client, TAX_YEAR_2025);

    expect(analysis.aggregateYearEndValue).toBeLessThan(analysis.form8938YearEndThreshold);
    expect(analysis.aggregateMaximumValue).toBeGreaterThan(analysis.form8938AnyTimeThreshold);
    expect(analysis.form8938ReviewFlag).toBe(true);
    expect(findingIds(evaluateClient(client).findings)).toContain('FATCA-8938');
  });

  it('uses the higher thresholds for a taxpayer living abroad', () => {
    const abroad = makeClient({
      filingStatus: 'marriedFilingJointly',
      residency: {
        stateCode: 'NY',
        stateName: 'New York',
        topMarginalStateRate: 0,
        residencyNote: 'Resident abroad.',
        livesAbroad: true,
        countryOfResidence: 'Singapore',
      },
      foreignAccounts: [
        makeForeignAccount({ maximumValueUSD: 160_000, yearEndValueUSD: 150_000 }),
      ],
    });
    const analysis = analyzeForeignAccounts(abroad, TAX_YEAR_2025);

    expect(analysis.form8938Basis).toBe('livingAbroad');
    expect(analysis.form8938YearEndThreshold).toBe(
      thresholds.livingAbroad.marriedFilingJointly.yearEnd,
    );
    expect(analysis.form8938ReviewFlag).toBe(false);
  });

  it('uses the single thresholds for an unmarried taxpayer', () => {
    const client = makeClient({
      filingStatus: 'single',
      spouseName: undefined,
      foreignAccounts: [
        makeForeignAccount({ maximumValueUSD: 60_000, yearEndValueUSD: 55_000 }),
      ],
    });
    const analysis = analyzeForeignAccounts(client, TAX_YEAR_2025);

    expect(analysis.form8938YearEndThreshold).toBe(thresholds.livingInUS.single.yearEnd);
    expect(analysis.form8938ReviewFlag).toBe(true);
  });
});

describe('foreign entity rules', () => {
  it('flags a foreign corporation interest at or above the 10% level', () => {
    const client = makeClient({
      foreignEntities: [
        {
          id: 'fe-1',
          name: 'Test Holdings Limited',
          country: 'Ireland',
          kind: 'foreignCorporation',
          ownershipPercent: 0.1,
          valueUSD: 500_000,
        },
      ],
    });
    expect(findingIds(evaluateClient(client).findings)).toContain('FOREIGN-5471');
  });

  it('does not flag a foreign corporation interest below the reporting level', () => {
    const client = makeClient({
      foreignEntities: [
        {
          id: 'fe-1',
          name: 'Test Holdings Limited',
          country: 'Ireland',
          kind: 'foreignCorporation',
          ownershipPercent: 0.09,
          valueUSD: 500_000,
        },
      ],
    });
    expect(findingIds(evaluateClient(client).findings)).not.toContain('FOREIGN-5471');
  });

  it('flags a pooled foreign investment fund as a PFIC candidate', () => {
    const client = makeClient({
      foreignAccounts: [
        makeForeignAccount({ accountType: 'pooledInvestmentFund', maximumValueUSD: 40_000 }),
      ],
    });
    expect(findingIds(evaluateClient(client).findings)).toContain('FOREIGN-PFIC');
  });

  it('flags a foreign employer pension arrangement', () => {
    const client = makeClient({
      foreignAccounts: [
        makeForeignAccount({ accountType: 'pension', isEmployerPlan: true, maximumValueUSD: 200_000 }),
      ],
    });
    expect(findingIds(evaluateClient(client).findings)).toContain('FOREIGN-EMPLOYER-PLAN');
  });
});
