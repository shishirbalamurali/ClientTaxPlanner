const currency0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const currency2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const number0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const percent1 = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const percent2 = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function usd(value: number, decimals: 0 | 2 = 0): string {
  return decimals === 0 ? currency0.format(value) : currency2.format(value);
}

/** Accounting-style rendering: negatives in parentheses, zero as an em dash. */
export function usdAccounting(value: number): string {
  if (value === 0) return '—';
  return value < 0 ? `(${currency0.format(Math.abs(value))})` : currency0.format(value);
}

export function compactUsd(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${number0.format(abs)}`;
}

export function pct(value: number, decimals: 1 | 2 = 1): string {
  return decimals === 1 ? percent1.format(value) : percent2.format(value);
}

export function count(value: number): string {
  return number0.format(value);
}

export function signed(value: number): string {
  if (value === 0) return '—';
  return `${value > 0 ? '+' : '−'}${currency0.format(Math.abs(value))}`;
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function titleFromCamelCase(value: string): string {
  const spaced = value.replace(/([A-Z])/g, ' $1').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

/** Article by leading sound, so generated sentences read as written rather than assembled. */
export function article(word: string): string {
  return /^[aeiou]/i.test(word.trim()) ? 'an' : 'a';
}
