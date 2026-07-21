export type CurrencyCode = "EUR" | "XOF";

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  EUR: "Euro (€)",
  XOF: "Franc CFA (XOF)",
};

export function formatPrice(amount: number, currency: CurrencyCode = "EUR") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(amount);
}
