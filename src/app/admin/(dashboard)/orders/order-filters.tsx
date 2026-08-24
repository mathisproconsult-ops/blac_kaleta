"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ORDER_STATUS_LABELS, ORDER_STATUS_ORDER } from "./status";

const SORT_OPTIONS = [
  { value: "recent", label: "Plus récent d'abord" },
  { value: "ancien", label: "Plus ancien d'abord" },
  { value: "montant-desc", label: "Montant décroissant" },
  { value: "montant-asc", label: "Montant croissant" },
];

function withParam(searchParams: URLSearchParams, key: string, value: string, fallback: string) {
  const params = new URLSearchParams(searchParams.toString());
  if (value === fallback) {
    params.delete(key);
  } else {
    params.set(key, value);
  }
  return `/admin/orders?${params.toString()}`;
}

export function OrderFilters({ statut, tri }: { statut: string; tri: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap items-center gap-1">
        {[{ value: "toutes", label: "Toutes" }, ...ORDER_STATUS_ORDER.map((value) => ({
          value,
          label: ORDER_STATUS_LABELS[value],
        }))].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => router.push(withParam(searchParams, "statut", option.value, "toutes"))}
            className={
              statut === option.value
                ? "border border-black bg-black px-3 py-1.5 text-xs font-medium text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      <select
        defaultValue={tri}
        onChange={(event) => router.push(withParam(searchParams, "tri", event.target.value, "recent"))}
        className="border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
