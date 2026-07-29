// Le client saisit et facture toujours en FCFA — l'EUR/USD ne sont que des
// conversions indicatives (voir formatIndicativeConversion ci-dessous).
export function formatPrice(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
  }).format(amount);
}

// Taux légal fixe (irrévocable) entre l'euro et le franc CFA — jamais mis à
// jour, aucune API nécessaire.
export const EUR_XOF_RATE = 655.957;

// Conversions purement indicatives affichées sous le prix principal en FCFA
// (le paiement se fait toujours dans la devise réellement facturée).
export function formatIndicativeConversion(
  amountXof: number,
  usdRate: number,
): string {
  const eur = amountXof / EUR_XOF_RATE;
  const usd = usdRate > 0 ? amountXof / usdRate : 0;
  const eurStr = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    Math.round(eur),
  );
  const usdStr = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.round(usd),
  );
  return `≈ ${eurStr} € / ${usdStr} $`;
}
