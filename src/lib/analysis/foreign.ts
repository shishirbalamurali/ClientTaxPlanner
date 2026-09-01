import type { TaxYearConstants } from '@/lib/tax-year';
import type { Client, ForeignAccount } from '@/lib/types';

export interface CountryExposure {
  country: string;
  accountCount: number;
  maximumValueUSD: number;
  yearEndValueUSD: number;
}

export interface ForeignAccountAnalysis {
  taxYear: number;
  accounts: ForeignAccount[];
  /**
   * The FBAR test aggregates the maximum value of every reportable account,
   * including accounts held only under signature authority.
   */
  aggregateMaximumValue: number;
  aggregateMaximumExcludingSignatureAuthority: number;
  aggregateYearEndValue: number;
  largestAccountValue: number;
  accountCount: number;
  signatureAuthorityOnlyCount: number;
  countries: CountryExposure[];
  fbarThreshold: number;
  fbarReviewFlag: boolean;
  fbarHeadroom: number;
  form8938YearEndThreshold: number;
  form8938AnyTimeThreshold: number;
  form8938ReviewFlag: boolean;
  form8938Basis: 'livingInUS' | 'livingAbroad';
  pooledFundAccounts: ForeignAccount[];
}

export function analyzeForeignAccounts(
  client: Client,
  constants: TaxYearConstants,
): ForeignAccountAnalysis {
  const accounts = [...client.foreignAccounts].sort(
    (a, b) => b.maximumValueUSD - a.maximumValueUSD,
  );

  const aggregateMaximumValue = accounts.reduce(
    (sum, account) => sum + account.maximumValueUSD,
    0,
  );
  const aggregateMaximumExcludingSignatureAuthority = accounts
    .filter((account) => account.interestType !== 'signatureAuthorityOnly')
    .reduce((sum, account) => sum + account.maximumValueUSD, 0);
  const aggregateYearEndValue = accounts.reduce(
    (sum, account) => sum + account.yearEndValueUSD,
    0,
  );

  const byCountry = new Map<string, CountryExposure>();
  for (const account of accounts) {
    const existing = byCountry.get(account.country) ?? {
      country: account.country,
      accountCount: 0,
      maximumValueUSD: 0,
      yearEndValueUSD: 0,
    };
    existing.accountCount += 1;
    existing.maximumValueUSD += account.maximumValueUSD;
    existing.yearEndValueUSD += account.yearEndValueUSD;
    byCountry.set(account.country, existing);
  }

  const fbarThreshold = constants.foreignReporting.fbarAggregateThreshold;
  const basis = client.residency.livesAbroad ? 'livingAbroad' : 'livingInUS';
  const form8938 = constants.foreignReporting.form8938[basis][client.filingStatus];

  return {
    taxYear: constants.year,
    accounts,
    aggregateMaximumValue,
    aggregateMaximumExcludingSignatureAuthority,
    aggregateYearEndValue,
    largestAccountValue: accounts[0]?.maximumValueUSD ?? 0,
    accountCount: accounts.length,
    signatureAuthorityOnlyCount: accounts.filter(
      (account) => account.interestType === 'signatureAuthorityOnly',
    ).length,
    countries: [...byCountry.values()].sort((a, b) => b.maximumValueUSD - a.maximumValueUSD),
    fbarThreshold,
    fbarReviewFlag: aggregateMaximumValue > fbarThreshold,
    fbarHeadroom: fbarThreshold - aggregateMaximumValue,
    form8938YearEndThreshold: form8938.yearEnd,
    form8938AnyTimeThreshold: form8938.anyTime,
    form8938ReviewFlag:
      aggregateYearEndValue > form8938.yearEnd || aggregateMaximumValue > form8938.anyTime,
    form8938Basis: basis,
    pooledFundAccounts: accounts.filter(
      (account) => account.accountType === 'pooledInvestmentFund',
    ),
  };
}
