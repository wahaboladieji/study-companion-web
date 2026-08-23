const CURRENCY_LABELS: Record<string, string> = {
  NGN: "\u20A6",
  USD: "$",
  EUR: "\u20AC",
  GBP: "\u00A3",
};

export function formatMoneyMinor(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  const symbol = CURRENCY_LABELS[currency.toUpperCase()] ?? `${currency} `;
  const formatted = new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: major % 1 === 0 ? 0 : 2,
    minimumFractionDigits: major % 1 === 0 ? 0 : 2,
  }).format(major);
  return `${symbol}${formatted}`;
}
