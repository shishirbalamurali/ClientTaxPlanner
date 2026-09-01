import { describe, expect, it } from 'vitest';
import {
  applyCharitableLimits,
  applySaltLimitation,
  bracketTax,
  marginalRate,
  runFederalModel,
  summarizeIncome,
} from '@/lib/analysis/federal-model';
import { evaluateClient } from '@/lib/rules';
import { TAX_YEAR_2025 } from '@/lib/tax-year';
import { findingIds, makeClient } from './factories';

describe('bracketTax', () => {
  const brackets = TAX_YEAR_2025.ordinaryRates.marriedFilingJointly;

  it('returns zero at or below zero taxable income', () => {
    expect(bracketTax(0, brackets)).toBe(0);
    expect(bracketTax(-5_000, brackets)).toBe(0);
  });

  it('taxes the first bracket at the lowest rate', () => {
    expect(bracketTax(23_850, brackets)).toBeCloseTo(2_385, 2);
  });

  it('matches the published cumulative amount at a bracket boundary', () => {
    // Rev. Proc. 2024-40, Table 1: $202,154.50 plus 37% of the excess over $751,600.
    expect(bracketTax(751_600, brackets)).toBeCloseTo(202_154.5, 2);
  });

  it('applies the top rate above the final threshold', () => {
    expect(bracketTax(1_751_600, brackets)).toBeCloseTo(202_154.5 + 1_000_000 * 0.37, 2);
  });

  it('reports the marginal rate for the bracket the income falls in', () => {
    expect(marginalRate(50_000, brackets)).toBe(0.12);
    expect(marginalRate(800_000, brackets)).toBe(0.37);
  });
});

describe('income summary', () => {
  const client = makeClient({
    income: {
      wages: 500_000,
      bonus: 100_000,
      equityCompensation: 400_000,
      taxableInterest: 50_000,
      taxExemptInterest: 30_000,
      qualifiedDividends: 80_000,
      nonQualifiedDividends: 20_000,
      shortTermCapitalGain: 40_000,
      longTermCapitalGain: 200_000,
      rentalIncome: 60_000,
    },
  });
  const income = summarizeIncome(client);

  it('excludes tax-exempt interest from total income', () => {
    expect(income.totalModeledIncome).toBe(1_450_000);
    expect(income.taxExemptInterest).toBe(30_000);
  });

  it('separates preferential income from ordinary income', () => {
    expect(income.preferentialIncome).toBe(280_000);
    expect(income.ordinaryIncome).toBe(1_170_000);
  });

  it('builds the investment income base from investment sources only', () => {
    expect(income.investmentIncome).toBe(50_000 + 100_000 + 240_000 + 60_000);
    expect(income.earnedIncome).toBe(1_000_000);
  });
});

describe('state and local tax limitation', () => {
  const status = 'marriedFilingJointly';

  it('allows the full statutory cap below the phase-down threshold', () => {
    const result = applySaltLimitation(80_000, 400_000, status, TAX_YEAR_2025);

    expect(result.phaseDownApplies).toBe(false);
    expect(result.cap).toBe(40_000);
    expect(result.allowed).toBe(40_000);
  });

  it('reduces the cap by 30% of income above the threshold', () => {
    const result = applySaltLimitation(80_000, 600_000, status, TAX_YEAR_2025);

    expect(result.phaseDownApplies).toBe(true);
    expect(result.capReducedBy).toBeCloseTo(30_000, 2);
    expect(result.cap).toBeCloseTo(10_000, 2);
  });

  it('never reduces the cap below the statutory floor', () => {
    const result = applySaltLimitation(500_000, 6_000_000, status, TAX_YEAR_2025);
    expect(result.cap).toBe(10_000);
  });

  it('allows only what was actually paid', () => {
    const result = applySaltLimitation(4_000, 200_000, status, TAX_YEAR_2025);
    expect(result.allowed).toBe(4_000);
  });
});

describe('charitable percentage limitations', () => {
  it('allows cash up to 60% of the contribution base', () => {
    const client = makeClient({ deductions: { charitableCash: 700_000 } });
    const result = applyCharitableLimits(client, 1_000_000, TAX_YEAR_2025);

    expect(result.cashAllowed).toBe(600_000);
    expect(result.disallowedCarryforward).toBe(100_000);
  });

  it('caps appreciated property at 30% of the contribution base', () => {
    const client = makeClient({ deductions: { charitableAppreciatedSecurities: 500_000 } });
    const result = applyCharitableLimits(client, 1_000_000, TAX_YEAR_2025);

    expect(result.appreciatedAllowed).toBe(300_000);
    expect(result.disallowedCarryforward).toBe(200_000);
  });

  it('fills the remaining 60% ceiling with cash after appreciated property', () => {
    const client = makeClient({
      deductions: { charitableCash: 500_000, charitableAppreciatedSecurities: 300_000 },
    });
    const result = applyCharitableLimits(client, 1_000_000, TAX_YEAR_2025);

    expect(result.appreciatedAllowed).toBe(300_000);
    expect(result.cashAllowed).toBe(300_000);
    expect(result.totalAllowed).toBe(600_000);
  });

  it('leaves nothing carried forward when contributions are within the ceilings', () => {
    const client = makeClient({ deductions: { charitableCash: 100_000 } });
    const result = applyCharitableLimits(client, 1_000_000, TAX_YEAR_2025);

    expect(result.disallowedCarryforward).toBe(0);
    expect(result.totalAllowed).toBe(100_000);
  });
});

describe('capital gain stacking', () => {
  it('applies the 0% band where ordinary income leaves room below the breakpoint', () => {
    const client = makeClient({
      income: { wages: 0, longTermCapitalGain: 80_000 },
    });
    const result = runFederalModel(client, TAX_YEAR_2025);

    expect(result.capitalGainDetail.atZero).toBeGreaterThan(0);
    expect(result.capitalGainTax).toBe(0);
  });

  it('pushes gain into the 20% band once ordinary income fills the lower bands', () => {
    const client = makeClient({
      income: { wages: 700_000, longTermCapitalGain: 1_000_000 },
    });
    const result = runFederalModel(client, TAX_YEAR_2025);

    expect(result.capitalGainDetail.atZero).toBe(0);
    expect(result.capitalGainDetail.atTwenty).toBeGreaterThan(0);
    expect(findingIds(evaluateClient(client).findings)).toContain('IND-CG-TOP-RATE');
  });

  it('never taxes more preferential income than the taxable income supports', () => {
    const client = makeClient({
      income: { wages: 0, longTermCapitalGain: 10_000 },
    });
    const result = runFederalModel(client, TAX_YEAR_2025);
    expect(result.preferentialTaxableIncome).toBeLessThanOrEqual(result.taxableIncome);
  });
});

describe('net investment income tax', () => {
  it('applies no tax where adjusted gross income is below the threshold', () => {
    const client = makeClient({
      income: { wages: 0, taxableInterest: 100_000 },
    });
    const result = runFederalModel(client, TAX_YEAR_2025);

    expect(result.netInvestmentIncomeTaxBase).toBe(0);
    expect(result.netInvestmentIncomeTax).toBe(0);
  });

  it('limits the base to income above the threshold when that is the smaller amount', () => {
    const client = makeClient({
      income: { wages: 240_000, taxableInterest: 100_000 },
    });
    const result = runFederalModel(client, TAX_YEAR_2025);

    // AGI 340,000 less the 250,000 threshold is 90,000, below the 100,000 of investment income.
    expect(result.netInvestmentIncomeTaxBase).toBe(90_000);
    expect(result.netInvestmentIncomeTax).toBeCloseTo(3_420, 2);
  });

  it('limits the base to net investment income when that is the smaller amount', () => {
    const client = makeClient({
      income: { wages: 2_000_000, taxableInterest: 50_000 },
    });
    const result = runFederalModel(client, TAX_YEAR_2025);

    expect(result.netInvestmentIncomeTaxBase).toBe(50_000);
  });
});

describe('deduction method', () => {
  it('takes the standard deduction where itemized deductions are smaller', () => {
    const client = makeClient({ deductions: { charitableCash: 5_000 } });
    const result = runFederalModel(client, TAX_YEAR_2025);

    expect(result.deductionMethod).toBe('standard');
    expect(result.deductionTaken).toBe(TAX_YEAR_2025.standardDeduction.marriedFilingJointly);
  });

  it('itemizes where the itemized total is larger', () => {
    const client = makeClient({ deductions: { charitableCash: 200_000 } });
    const result = runFederalModel(client, TAX_YEAR_2025);

    expect(result.deductionMethod).toBe('itemized');
    expect(result.deductionTaken).toBeGreaterThan(
      TAX_YEAR_2025.standardDeduction.marriedFilingJointly,
    );
  });
});
