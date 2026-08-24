"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/currency";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { deleteCustomer } from "./actions";

type Customer = {
  name: string;
  email: string;
  orderCount: number;
  totalSpent: number;
};

export function CustomerSearch({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query),
    );
  }, [customers, search]);

  return (
    <div>
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Rechercher par nom ou email"
        className="mt-6 w-full max-w-sm border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
      />

      {filtered.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucun client ne correspond.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-4">Nom</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Commandes</th>
                <th className="py-2 pr-4">Total dépensé</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr key={customer.email} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/admin/customers/${encodeURIComponent(customer.email)}`}
                      className="hover:underline"
                    >
                      {customer.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-zinc-600 dark:text-zinc-400">{customer.email}</td>
                  <td className="py-3 pr-4">{customer.orderCount}</td>
                  <td className="py-3 pr-4">{formatPrice(customer.totalSpent)}</td>
                  <td className="py-3">
                    <form action={deleteCustomer.bind(null, customer.email)}>
                      <ConfirmSubmitButton
                        confirmMessage={`Es-tu sûr de vouloir supprimer ${customer.name} ? Cela supprimera aussi toutes ses commandes (${customer.orderCount}). Cette action est irréversible.`}
                        pendingText="…"
                        className="text-xs text-red-600 hover:underline dark:text-red-400"
                      >
                        Supprimer
                      </ConfirmSubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
