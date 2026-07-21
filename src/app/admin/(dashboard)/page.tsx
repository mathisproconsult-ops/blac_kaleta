import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Overview — Admin Blac_Kaleta",
};

export default function AdminOverviewPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Overview
      </h1>
      <p className="mt-4 text-sm text-zinc-600">
        Connexion réussie. Les statistiques (ventes, commandes, stock)
        s&apos;afficheront ici une fois les commandes et produits en place.
      </p>
    </div>
  );
}
