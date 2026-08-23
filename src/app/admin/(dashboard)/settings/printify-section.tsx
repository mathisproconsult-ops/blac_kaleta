"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import {
  updatePrintifyCredentials,
  syncPrintifyProducts,
  type PrintifyActionState,
  type PrintifySyncState,
} from "./printify-actions";

const initialCredentialsState: PrintifyActionState = { success: false, error: null };
const initialSyncState: PrintifySyncState = { success: false, error: null, imported: 0 };

export function PrintifySection({
  apiKey,
  shopId,
}: {
  apiKey: string;
  shopId: string;
}) {
  const [credState, credAction] = useActionState(updatePrintifyCredentials, initialCredentialsState);
  const [syncState, syncAction] = useActionState(syncPrintifyProducts, initialSyncState);

  return (
    <fieldset className="mt-8 flex max-w-2xl flex-col gap-3">
      <legend className="text-sm font-semibold uppercase tracking-wide">Printify</legend>
      <p className="text-xs text-zinc-500">
        Connecte ta boutique Printify pour importer ses produits (print-on-demand)
        dans la section Produits. Clé API et Shop ID disponibles dans ton compte
        Printify sous Account → Connections → API.
      </p>

      <form action={credAction} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">Clé API Printify</label>
          <input
            name="printify_api_key"
            type="password"
            autoComplete="off"
            defaultValue={apiKey}
            className="w-full border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">Shop ID</label>
          <input
            name="printify_shop_id"
            type="text"
            autoComplete="off"
            defaultValue={shopId}
            className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
        </div>
        <SubmitButton
          pendingText="Enregistrement…"
          className="bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Enregistrer
        </SubmitButton>
      </form>

      <div aria-live="polite">
        {credState.error ? (
          <p className="border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            ⚠ {credState.error}
          </p>
        ) : credState.success ? (
          <p className="border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            ✓ Identifiants Printify enregistrés.
          </p>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href="https://printify.com/app/catalog"
          target="_blank"
          rel="noopener noreferrer"
          className="border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Créer un produit sur Printify ↗
        </a>
        <form action={syncAction}>
          <SubmitButton
            pendingText="Synchronisation…"
            className="border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Synchroniser les produits
          </SubmitButton>
        </form>
      </div>

      <div aria-live="polite">
        {syncState.error ? (
          <p className="border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            ⚠ {syncState.error}
          </p>
        ) : syncState.success ? (
          <p className="border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            ✓ {syncState.imported} produit{syncState.imported > 1 ? "s" : ""} synchronisé
            {syncState.imported > 1 ? "s" : ""}.
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}
