"use client";

import { useActionState } from "react";
import { importProductsCsv, type ImportState } from "./csv-actions";

const initialState: ImportState = { message: null, error: null };

export function ImportCsvForm() {
  const [state, formAction, pending] = useActionState(importProductsCsv, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Fichier CSV exporté depuis WooCommerce (colonnes Name, Regular price,
        Stock, Description, Categories, Images).
      </p>
      <input
        type="file"
        name="file"
        accept=".csv"
        required
        className="text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? "Import en cours..." : "Importer"}
      </button>
      {state.message ? (
        <p className="text-sm text-green-700 dark:text-green-300">{state.message}</p>
      ) : null}
      {state.error ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : null}
    </form>
  );
}
