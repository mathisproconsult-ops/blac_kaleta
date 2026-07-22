import type { Metadata } from "next";
import { getCurrency } from "@/lib/settings";
import { CartView } from "./cart-view";

export const metadata: Metadata = {
  title: "Panier — Blac_Kaleta",
};

export default async function CartPage() {
  const currency = await getCurrency();

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <h1 className="text-2xl font-semibold uppercase tracking-wide">Panier</h1>
      <CartView currency={currency} />
    </div>
  );
}
