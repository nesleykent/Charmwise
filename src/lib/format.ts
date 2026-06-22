// Small display-formatting helpers shared by the results components.

export function formatNumber(value: number, locale: string = 'en-GB'): string {
  if (!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

export function formatSigned(value: number, locale: string = 'en-GB'): string {
  if (!Number.isFinite(value)) return '-';
  const formatted = formatNumber(Math.abs(value), locale);
  return value < 0 ? `-${formatted}` : `+${formatted}`;
}

export function formatPercent(fraction: number, fractionDigits = 1): string {
  if (!Number.isFinite(fraction)) return '-';
  return `${(fraction * 100).toFixed(fractionDigits)}%`;
}

export function formatScore(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(1);
}
