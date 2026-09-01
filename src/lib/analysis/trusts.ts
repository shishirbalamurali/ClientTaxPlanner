import { bracketTax } from './federal-model';
import type { TaxYearConstants } from '@/lib/tax-year';
import type { Client, TrustRecord } from '@/lib/types';

export interface TrustSummary {
  trust: TrustRecord;
  grossIncome: number;
  investmentIncome: number;
  distributions: number;
  retainedIncome: number;
  deductibleExpenses: number;
  /** Modeled taxable income at the fiduciary level, before the distribution deduction. */
  netAccountingIncome: number;
  isGrantorTrust: boolean;
  /** A charitable remainder trust is generally exempt from income tax. */
  isTaxExempt: boolean;
  /** Illustrative fiduciary tax on retained income at the compressed rates. */
  illustrativeFiduciaryTax: number;
  retainedIncomeAboveTopBracket: number;
  undistributedInvestmentIncome: number;
  netInvestmentIncomeTaxBase: number;
  meetsGrossIncomeFilingThreshold: boolean;
  distributionRate: number;
}

export interface TrustPortfolioAnalysis {
  taxYear: number;
  trusts: TrustSummary[];
  totalPrincipal: number;
  totalGrossIncome: number;
  totalDistributions: number;
  totalRetainedIncome: number;
  totalIllustrativeFiduciaryTax: number;
  incomeByCategory: {
    interest: number;
    dividends: number;
    capitalGains: number;
    rental: number;
    other: number;
  };
  nonGrantorTrustCount: number;
  grantorTrustCount: number;
  topBracketThreshold: number;
  filingThreshold: number;
}

function isGrantor(trust: TrustRecord): boolean {
  return trust.kind === 'grantorRevocable' || trust.kind === 'irrevocableGrantor';
}

export function summarizeTrust(
  trust: TrustRecord,
  constants: TaxYearConstants,
): TrustSummary {
  const { interest, dividends, capitalGains, rental, other } = trust.income;
  const grossIncome = interest + dividends + capitalGains + rental + other;
  const investmentIncome = interest + dividends + capitalGains + rental;

  // Capital gains are ordinarily allocated to principal and therefore excluded
  // from distributable net income unless the instrument or local law directs
  // otherwise. Fiduciary accounting income is modeled accordingly.
  const netAccountingIncome = trust.capitalGainsAllocatedToIncome
    ? grossIncome
    : grossIncome - capitalGains;

  const deductibleExpenses = trust.fiduciaryFees + trust.stateAndLocalTaxes;
  const distributions = trust.distributionsToBeneficiaries;
  const retainedIncome = Math.max(0, grossIncome - distributions - deductibleExpenses);

  const grantorTrust = isGrantor(trust);
  // A charitable remainder trust is exempt from income tax under § 664(c) absent
  // unrelated business taxable income, so no fiduciary tax is modeled for it.
  const taxExempt = trust.kind === 'charitableRemainderUnitrust';
  const exemption =
    distributions > 0
      ? constants.fiduciary.exemptionComplexTrust
      : constants.fiduciary.exemptionSimpleTrust;

  const taxableAtFiduciaryLevel =
    grantorTrust || taxExempt ? 0 : Math.max(0, retainedIncome - exemption);

  const undistributedInvestmentIncome =
    grantorTrust || taxExempt ? 0 : Math.max(0, investmentIncome - distributions);

  return {
    trust,
    grossIncome,
    investmentIncome,
    distributions,
    retainedIncome,
    deductibleExpenses,
    netAccountingIncome,
    isGrantorTrust: grantorTrust,
    isTaxExempt: taxExempt,
    illustrativeFiduciaryTax: bracketTax(taxableAtFiduciaryLevel, constants.fiduciary.rates),
    retainedIncomeAboveTopBracket: Math.max(
      0,
      taxableAtFiduciaryLevel - constants.fiduciary.netInvestmentIncomeThreshold,
    ),
    undistributedInvestmentIncome,
    netInvestmentIncomeTaxBase: Math.max(
      0,
      Math.min(
        undistributedInvestmentIncome,
        taxableAtFiduciaryLevel - constants.fiduciary.netInvestmentIncomeThreshold,
      ),
    ),
    meetsGrossIncomeFilingThreshold: grossIncome >= constants.fiduciary.grossIncomeFilingThreshold,
    distributionRate: grossIncome > 0 ? distributions / grossIncome : 0,
  };
}

export function analyzeTrusts(
  client: Client,
  constants: TaxYearConstants,
): TrustPortfolioAnalysis {
  const trusts = client.trusts.map((trust) => summarizeTrust(trust, constants));

  const incomeByCategory = client.trusts.reduce(
    (acc, trust) => ({
      interest: acc.interest + trust.income.interest,
      dividends: acc.dividends + trust.income.dividends,
      capitalGains: acc.capitalGains + trust.income.capitalGains,
      rental: acc.rental + trust.income.rental,
      other: acc.other + trust.income.other,
    }),
    { interest: 0, dividends: 0, capitalGains: 0, rental: 0, other: 0 },
  );

  return {
    taxYear: constants.year,
    trusts,
    totalPrincipal: client.trusts.reduce((sum, trust) => sum + trust.principalValue, 0),
    totalGrossIncome: trusts.reduce((sum, trust) => sum + trust.grossIncome, 0),
    totalDistributions: trusts.reduce((sum, trust) => sum + trust.distributions, 0),
    totalRetainedIncome: trusts.reduce((sum, trust) => sum + trust.retainedIncome, 0),
    totalIllustrativeFiduciaryTax: trusts.reduce(
      (sum, trust) => sum + trust.illustrativeFiduciaryTax,
      0,
    ),
    incomeByCategory,
    nonGrantorTrustCount: trusts.filter((trust) => !trust.isGrantorTrust).length,
    grantorTrustCount: trusts.filter((trust) => trust.isGrantorTrust).length,
    topBracketThreshold: constants.fiduciary.netInvestmentIncomeThreshold,
    filingThreshold: constants.fiduciary.grossIncomeFilingThreshold,
  };
}
