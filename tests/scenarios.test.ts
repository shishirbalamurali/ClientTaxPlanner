import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCENARIO_PARAMETERS,
  SCENARIO_ROWS,
  buildScenarios,
} from '@/lib/analysis/scenarios';
import { CORPORATE_EXECUTIVE } from '@/data/clients';
import { TAX_YEAR_2025 } from '@/lib/tax-year';
import { makeClient, makeGift } from './factories';

describe('scenario construction', () => {
  const comparison = buildScenarios(CORPORATE_EXECUTIVE, TAX_YEAR_2025);

  it('produces the four documented columns in a fixed order', () => {
    expect(comparison.scenarios.map((scenario) => scenario.key)).toEqual([
      'current',
      'giftPlanning',
      'charitableGiving',
      'capitalGainTiming',
    ]);
  });

  it('uses the current position as the baseline', () => {
    expect(comparison.baseline.key).toBe('current');
    expect(comparison.baseline.metrics.totalModeledIncome).toBe(
      comparison.scenarios[0]?.metrics.totalModeledIncome,
    );
  });

  it('states at least one assumption for every column', () => {
    for (const scenario of comparison.scenarios) {
      expect(scenario.assumptions.length, scenario.key).toBeGreaterThan(0);
      expect(scenario.authorityIds.length, scenario.key).toBeGreaterThan(0);
    }
  });

  it('exposes every comparison row as a metric key', () => {
    for (const row of SCENARIO_ROWS) {
      expect(comparison.baseline.metrics[row.key], row.key).toBeTypeOf('number');
    }
  });

  it('leaves the client record untouched', () => {
    const before = JSON.stringify(CORPORATE_EXECUTIVE);
    buildScenarios(CORPORATE_EXECUTIVE, TAX_YEAR_2025);
    expect(JSON.stringify(CORPORATE_EXECUTIVE)).toBe(before);
  });
});

describe('gift planning scenario', () => {
  const client = makeClient({
    gifts: [makeGift({ amount: 5_000 })],
  });

  it('increases the amount transferred without changing modeled income', () => {
    const { scenarios } = buildScenarios(client, TAX_YEAR_2025);
    const [current, giftPlan] = scenarios;

    expect(giftPlan!.metrics.totalGifted).toBeGreaterThan(current!.metrics.totalGifted);
    expect(giftPlan!.metrics.totalModeledIncome).toBe(current!.metrics.totalModeledIncome);
    expect(giftPlan!.metrics.totalFederalTax).toBe(current!.metrics.totalFederalTax);
  });

  it('keeps the additional transfers inside the annual exclusion', () => {
    const { scenarios } = buildScenarios(client, TAX_YEAR_2025);
    expect(scenarios[1]!.metrics.taxableGiftsReported).toBe(0);
  });

  it('adds the requested number of hypothetical donees', () => {
    const { scenarios } = buildScenarios(client, TAX_YEAR_2025, {
      ...DEFAULT_SCENARIO_PARAMETERS,
      additionalDonees: 4,
      topUpDoneesToExclusion: false,
    });
    expect(scenarios[1]!.gifts.donees).toHaveLength(5);
  });
});

describe('charitable giving scenario', () => {
  it('increases the deduction where contribution base room remains', () => {
    const client = makeClient({
      income: { wages: 4_000_000 },
      deductions: { charitableAppreciatedSecurities: 0 },
    });
    const { scenarios } = buildScenarios(client, TAX_YEAR_2025);
    const [current, , charitable] = scenarios;

    expect(charitable!.metrics.charitableDeductionAllowed).toBeGreaterThan(
      current!.metrics.charitableDeductionAllowed,
    );
    expect(charitable!.metrics.totalFederalTax).toBeLessThan(current!.metrics.totalFederalTax);
  });

  it('carries the excess forward once the 30% ceiling is reached', () => {
    const client = makeClient({ income: { wages: 300_000 } });
    const { scenarios } = buildScenarios(client, TAX_YEAR_2025, {
      ...DEFAULT_SCENARIO_PARAMETERS,
      incrementalAppreciatedGift: 1_000_000,
    });
    expect(scenarios[2]!.metrics.charitableCarryforward).toBeGreaterThan(0);
  });
});

describe('capital gain timing scenario', () => {
  const client = makeClient({
    income: { wages: 800_000, longTermCapitalGain: 2_000_000 },
  });

  it('removes the deferred gain from modeled income', () => {
    const { scenarios } = buildScenarios(client, TAX_YEAR_2025);
    const [current, , , timing] = scenarios;

    expect(timing!.metrics.gainDeferred).toBe(1_000_000);
    expect(current!.metrics.totalModeledIncome - timing!.metrics.totalModeledIncome).toBe(
      1_000_000,
    );
  });

  it('reduces both the capital gain tax and the net investment income tax', () => {
    const { scenarios } = buildScenarios(client, TAX_YEAR_2025);
    const [current, , , timing] = scenarios;

    expect(timing!.metrics.capitalGainTax).toBeLessThan(current!.metrics.capitalGainTax);
    expect(timing!.metrics.netInvestmentIncomeTax).toBeLessThan(
      current!.metrics.netInvestmentIncomeTax,
    );
  });

  it('leaves the year unchanged at a zero deferral share', () => {
    const { scenarios } = buildScenarios(client, TAX_YEAR_2025, {
      ...DEFAULT_SCENARIO_PARAMETERS,
      capitalGainDeferralShare: 0,
    });
    expect(scenarios[3]!.metrics.totalFederalTax).toBeCloseTo(
      scenarios[0]!.metrics.totalFederalTax,
      6,
    );
  });
});
