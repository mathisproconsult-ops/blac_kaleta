import type { Metadata } from "next";
import { BackButton } from "@/components/back-button";
import { CheckoutView } from "./checkout-view";

export const metadata: Metadata = {
  title: "Commande — Blac_Kaleta",
};

export default function CheckoutPage() {
  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <BackButton />
      <h1 className="mt-2 text-2xl font-semibold uppercase tracking-wide">Commande</h1>
      <CheckoutView />
    </div>
  );
}
