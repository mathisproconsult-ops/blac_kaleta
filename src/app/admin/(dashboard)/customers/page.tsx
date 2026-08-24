import type { Metadata } from "next";
import { CustomerSearch } from "./customer-search";
import { CustomerForm } from "./customer-form";
import { getAggregatedCustomers } from "./get-customers";

export const metadata: Metadata = {
  title: "Clients — Admin Blac_Kaleta",
};

export default async function CustomersPage() {
  const { customers, error } = await getAggregatedCustomers();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold uppercase tracking-wide">
          Clients
        </h1>
        <CustomerForm />
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          Erreur de chargement : {error}
        </p>
      ) : null}

      {customers.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucun client pour l&apos;instant.</p>
      ) : (
        <CustomerSearch customers={customers} />
      )}
    </div>
  );
}
