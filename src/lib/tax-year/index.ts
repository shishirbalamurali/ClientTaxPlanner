import { TAX_YEAR_2025 } from './2025';
import type { TaxYearConstants } from './types';

export type { TaxYearConstants, RateBracket, ByFilingStatus } from './types';

const REGISTRY: Record<number, TaxYearConstants> = {
  2025: TAX_YEAR_2025,
};

export const DEFAULT_TAX_YEAR = 2025;

export const SUPPORTED_TAX_YEARS = Object.keys(REGISTRY)
  .map(Number)
  .sort((a, b) => a - b);

export function getTaxYear(year: number = DEFAULT_TAX_YEAR): TaxYearConstants {
  const constants = REGISTRY[year];
  if (!constants) {
    throw new Error(
      `No modeled constants for tax year ${year}. Supported: ${SUPPORTED_TAX_YEARS.join(', ')}.`,
    );
  }
  return constants;
}

export { TAX_YEAR_2025 };
