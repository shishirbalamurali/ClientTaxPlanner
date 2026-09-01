import { describe, expect, it } from 'vitest';
import { analyzeTrusts, summarizeTrust } from '@/lib/analysis/trusts';
import { evaluateClient } from '@/lib/rules';
import { TAX_YEAR_2025 } from '@/lib/tax-year';
import { findingIds, makeClient, makeTrust } from './factories';

const TOP_BRACKET = TAX_YEAR_2025.fiduciary.netInvestmentIncomeThreshold;
const FILING_THRESHOLD = TAX_YEAR_2025.fiduciary.grossIncomeFilingThreshold;

describe('clients without trusts', () => {
  const client = makeClient({ trusts: [] });

  it('produces an empty portfolio analysis', () => {
    const analysis = analyzeTrusts(client, TAX_YEAR_2025);

    expect(analysis.trusts).toHaveLength(0);
    expect(analysis.totalGrossIncome).toBe(0);
    expect(analysis.totalDistributions).toBe(0);
    expect(analysis.nonGrantorTrustCount).toBe(0);
  });

  it('raises no fiduciary findings', () => {
    const trustFindings = evaluateClient(client).findings.filter(
      (finding) => finding.module === 'trust',
    );
    expect(trustFindings).toHaveLength(0);
  });
});

describe('Form 1041 filing threshold', () => {
  it('does not flag a trust with gross income below the threshold', () => {
    const client = makeClient({
      trusts: [makeTrust({ income: { interest: FILING_THRESHOLD - 1 } })],
    });
    const analysis = analyzeTrusts(client, TAX_YEAR_2025);

    expect(analysis.trusts[0]?.meetsGrossIncomeFilingThreshold).toBe(false);
    expect(findingIds(evaluateClient(client).findings)).not.toContain('TRUST-1041-THRESHOLD');
  });

  it('flags a trust with gross income exactly at the threshold', () => {
    const client = makeClient({
      trusts: [makeTrust({ income: { interest: FILING_THRESHOLD } })],
    });
    const analysis = analyzeTrusts(client, TAX_YEAR_2025);

    expect(analysis.trusts[0]?.meetsGrossIncomeFilingThreshold).toBe(true);
    expect(findingIds(evaluateClient(client).findings)).toContain('TRUST-1041-THRESHOLD');
  });

  it('does not raise the Form 1041 item for a grantor trust', () => {
    const client = makeClient({
      trusts: [
        makeTrust({ kind: 'grantorRevocable', income: { interest: 500_000 } }),
      ],
    });
    const ids = findingIds(evaluateClient(client).findings);

    expect(ids).not.toContain('TRUST-1041-THRESHOLD');
    expect(ids).toContain('TRUST-GRANTOR-REPORTING');
  });

  it('routes a charitable remainder trust to Form 5227 rather than Form 1041', () => {
    const client = makeClient({
      trusts: [
        makeTrust({
          kind: 'charitableRemainderUnitrust',
          income: { dividends: 200_000, capitalGains: 400_000 },
          distributionsToBeneficiaries: 180_000,
        }),
      ],
    });
    const ids = findingIds(evaluateClient(client).findings);

    expect(ids).toContain('TRUST-CRT-5227');
    expect(ids).not.toContain('TRUST-1041-THRESHOLD');
    expect(ids).not.toContain('TRUST-COMPRESSED-BRACKETS');
  });
});

describe('retained income and the compressed rate schedule', () => {
  it('computes retained income after distributions and deductible expenses', () => {
    const trust = makeTrust({
      income: { interest: 50_000, dividends: 50_000 },
      distributionsToBeneficiaries: 40_000,
      fiduciaryFees: 10_000,
      stateAndLocalTaxes: 5_000,
    });
    const summary = summarizeTrust(trust, TAX_YEAR_2025);

    expect(summary.grossIncome).toBe(100_000);
    expect(summary.deductibleExpenses).toBe(15_000);
    expect(summary.retainedIncome).toBe(45_000);
  });

  it('does not flag a trust that distributes all of its income', () => {
    const client = makeClient({
      trusts: [
        makeTrust({
          income: { interest: 60_000 },
          distributionsToBeneficiaries: 60_000,
        }),
      ],
    });
    const ids = findingIds(evaluateClient(client).findings);

    expect(analyzeTrusts(client, TAX_YEAR_2025).totalRetainedIncome).toBe(0);
    expect(ids).not.toContain('TRUST-COMPRESSED-BRACKETS');
    expect(ids).not.toContain('TRUST-NIIT');
  });

  it('flags retained income above the top fiduciary bracket', () => {
    const client = makeClient({
      trusts: [makeTrust({ income: { interest: TOP_BRACKET + 50_000 } })],
    });
    const analysis = analyzeTrusts(client, TAX_YEAR_2025);

    expect(analysis.trusts[0]?.retainedIncomeAboveTopBracket).toBeGreaterThan(0);
    expect(analysis.totalIllustrativeFiduciaryTax).toBeGreaterThan(0);
    expect(findingIds(evaluateClient(client).findings)).toContain('TRUST-COMPRESSED-BRACKETS');
  });

  it('charges no fiduciary tax on a charitable remainder trust', () => {
    const summary = summarizeTrust(
      makeTrust({
        kind: 'charitableRemainderUnitrust',
        income: { dividends: 200_000, capitalGains: 500_000 },
        distributionsToBeneficiaries: 180_000,
      }),
      TAX_YEAR_2025,
    );

    expect(summary.isTaxExempt).toBe(true);
    expect(summary.illustrativeFiduciaryTax).toBe(0);
    expect(summary.netInvestmentIncomeTaxBase).toBe(0);
  });

  it('charges no fiduciary tax on a grantor trust', () => {
    const summary = summarizeTrust(
      makeTrust({ kind: 'irrevocableGrantor', income: { interest: 500_000 } }),
      TAX_YEAR_2025,
    );

    expect(summary.isGrantorTrust).toBe(true);
    expect(summary.illustrativeFiduciaryTax).toBe(0);
    expect(summary.undistributedInvestmentIncome).toBe(0);
  });
});

describe('capital gain allocation', () => {
  it('excludes gains from accounting income when allocated to principal', () => {
    const summary = summarizeTrust(
      makeTrust({
        income: { interest: 20_000, capitalGains: 300_000 },
        capitalGainsAllocatedToIncome: false,
      }),
      TAX_YEAR_2025,
    );

    expect(summary.grossIncome).toBe(320_000);
    expect(summary.netAccountingIncome).toBe(20_000);
  });

  it('includes gains in accounting income when the instrument so allocates', () => {
    const summary = summarizeTrust(
      makeTrust({
        income: { interest: 20_000, capitalGains: 300_000 },
        capitalGainsAllocatedToIncome: true,
      }),
      TAX_YEAR_2025,
    );

    expect(summary.netAccountingIncome).toBe(320_000);
  });

  it('flags a material gain allocation to principal', () => {
    const client = makeClient({
      trusts: [
        makeTrust({
          income: { interest: 20_000, capitalGains: 300_000 },
          capitalGainsAllocatedToIncome: false,
        }),
      ],
    });
    expect(findingIds(evaluateClient(client).findings)).toContain(
      'TRUST-CAPITAL-GAIN-ALLOCATION',
    );
  });
});

describe('nonresident alien beneficiaries', () => {
  it('flags a domestic non-grantor trust with a nonresident alien beneficiary', () => {
    const client = makeClient({
      trusts: [
        makeTrust({ income: { interest: 5_000 }, hasNonresidentAlienBeneficiary: true }),
      ],
    });
    expect(findingIds(evaluateClient(client).findings)).toContain('TRUST-NRA-BENEFICIARY');
  });

  it('does not raise the Form 1041 item for a foreign trust', () => {
    const client = makeClient({
      trusts: [
        makeTrust({
          kind: 'irrevocableGrantor',
          isForeignTrust: true,
          situs: 'Jersey, Channel Islands',
          income: { interest: 80_000 },
          hasNonresidentAlienBeneficiary: true,
        }),
      ],
    });
    const ids = findingIds(evaluateClient(client).findings);

    expect(ids).toContain('FOREIGN-3520-TRUST');
    expect(ids).not.toContain('TRUST-NRA-BENEFICIARY');
  });
});

describe('multiple trusts', () => {
  const client = makeClient({
    income: { trustDistributions: 25_000 },
    trusts: [
      makeTrust({ id: 't1', name: 'Trust One', income: { interest: 30_000 }, distributionsToBeneficiaries: 25_000 }),
      makeTrust({ id: 't2', name: 'Trust Two', kind: 'grantorRevocable', income: { dividends: 90_000 } }),
      makeTrust({ id: 't3', name: 'Trust Three', income: { rental: 200_000 }, distributionsToBeneficiaries: 0 }),
    ],
  });

  it('totals income and distributions across the portfolio', () => {
    const analysis = analyzeTrusts(client, TAX_YEAR_2025);

    expect(analysis.trusts).toHaveLength(3);
    expect(analysis.totalGrossIncome).toBe(320_000);
    expect(analysis.totalDistributions).toBe(25_000);
    expect(analysis.grantorTrustCount).toBe(1);
    expect(analysis.nonGrantorTrustCount).toBe(2);
  });

  it('ties non-grantor distributions to the individual record', () => {
    expect(findingIds(evaluateClient(client).findings)).not.toContain(
      'TRUST-DISTRIBUTION-TIE-OUT',
    );
  });

  it('raises a tie-out item where the two figures disagree', () => {
    const mismatched = makeClient({
      income: { trustDistributions: 0 },
      trusts: client.trusts,
    });
    expect(findingIds(evaluateClient(mismatched).findings)).toContain(
      'TRUST-DISTRIBUTION-TIE-OUT',
    );
  });
});
