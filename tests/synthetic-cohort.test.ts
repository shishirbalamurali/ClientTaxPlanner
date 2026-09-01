import { describe, expect, it } from 'vitest';
import { generateClient, generateCohort } from '@/data/synthetic/generator';
import { buildExecutiveSummary } from '@/lib/analysis/executive-summary';
import { buildScenarios } from '@/lib/analysis/scenarios';
import { RULES, evaluateClient } from '@/lib/rules';
import { TAX_YEAR_2025 } from '@/lib/tax-year';

const COHORT = generateCohort({ count: 100, seed: 20250101, taxYear: 2025 });

describe('generator determinism', () => {
  it('reproduces the same cohort from the same seed', () => {
    const again = generateCohort({ count: 100, seed: 20250101, taxYear: 2025 });
    expect(JSON.stringify(again)).toBe(JSON.stringify(COHORT));
  });

  it('produces a different cohort from a different seed', () => {
    const other = generateCohort({ count: 10, seed: 99, taxYear: 2025 });
    expect(JSON.stringify(other.slice(0, 10))).not.toBe(JSON.stringify(COHORT.slice(0, 10)));
  });

  it('generates a single record identically in isolation', () => {
    const standalone = generateClient(7, { count: 100, seed: 20250101, taxYear: 2025 });
    expect(JSON.stringify(standalone)).toBe(JSON.stringify(COHORT[7]));
  });
});

describe('cohort shape', () => {
  it('generates the requested number of records with unique ids', () => {
    expect(COHORT).toHaveLength(100);
    expect(new Set(COHORT.map((client) => client.id)).size).toBe(100);
  });

  it('covers all three archetypes', () => {
    const archetypes = new Set(COHORT.map((client) => client.archetype));
    expect(archetypes.size).toBe(3);
  });

  it('spans both sides of the FBAR aggregate threshold', () => {
    const evaluations = COHORT.map((client) => evaluateClient(client));
    const flagged = evaluations.filter((entry) => entry.foreign.fbarReviewFlag).length;

    expect(flagged).toBeGreaterThan(0);
    expect(flagged).toBeLessThan(COHORT.length);
  });

  it('spans both sides of the annual gift exclusion', () => {
    const over = COHORT.filter((client) =>
      client.gifts.some(
        (gift) => gift.amount > TAX_YEAR_2025.wealthTransfer.annualGiftExclusion,
      ),
    ).length;
    const under = COHORT.filter((client) =>
      client.gifts.some(
        (gift) => gift.amount < TAX_YEAR_2025.wealthTransfer.annualGiftExclusion,
      ),
    ).length;

    expect(over).toBeGreaterThan(0);
    expect(under).toBeGreaterThan(0);
  });

  it('includes clients with and without trusts', () => {
    expect(COHORT.some((client) => client.trusts.length === 0)).toBe(true);
    expect(COHORT.some((client) => client.trusts.length > 1)).toBe(true);
  });

  it('includes clients with several foreign accounts', () => {
    expect(COHORT.some((client) => client.foreignAccounts.length >= 3)).toBe(true);
    expect(COHORT.some((client) => client.foreignAccounts.length === 0)).toBe(true);
  });

  it('includes clients with several gift recipients', () => {
    expect(COHORT.some((client) => client.gifts.length >= 3)).toBe(true);
    expect(COHORT.some((client) => client.gifts.length === 0)).toBe(true);
  });
});

describe('rule set against the cohort', () => {
  const evaluations = COHORT.map((client) => evaluateClient(client));

  it('evaluates every record without throwing', () => {
    expect(evaluations).toHaveLength(COHORT.length);
  });

  it('exercises every rule at least once', () => {
    const fired = new Set(
      evaluations.flatMap((evaluation) => evaluation.findings.map((finding) => finding.ruleId)),
    );
    const missing = RULES.filter((rule) => !fired.has(rule.id)).map((rule) => rule.id);
    expect(missing).toEqual([]);
  });

  it('produces finite modeled figures for every record', () => {
    for (const evaluation of evaluations) {
      expect(Number.isFinite(evaluation.federal.totalFederalTax)).toBe(true);
      expect(evaluation.federal.totalFederalTax).toBeGreaterThanOrEqual(0);
      expect(evaluation.federal.taxableIncome).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(evaluation.gifts.totalExceedingExclusion)).toBe(true);
      expect(Number.isFinite(evaluation.foreign.aggregateMaximumValue)).toBe(true);
    }
  });

  it('never reports tax above modeled income', () => {
    for (const evaluation of evaluations) {
      expect(evaluation.federal.totalFederalTax).toBeLessThanOrEqual(
        evaluation.federal.income.totalModeledIncome,
      );
    }
  });

  it('builds scenarios and an executive summary for every record', () => {
    for (const client of COHORT) {
      const comparison = buildScenarios(client, TAX_YEAR_2025);
      expect(comparison.scenarios).toHaveLength(4);
      const summary = buildExecutiveSummary(client, '2026-01-01');
      expect(summary.overview.length).toBeGreaterThan(0);
      expect(summary.characteristics.length).toBeGreaterThan(0);
    }
  });
});
