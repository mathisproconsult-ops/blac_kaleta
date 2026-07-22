"use client";

import { useActionState } from "react";
import { migrateExternalProductImages, type MigrationState } from "./migrate-actions";

const initialState: MigrationState = { message: null, error: null };

export function MigrateImagesButton() {
  const [state, formAction, pending] = useActionState(
    migrateExternalProductImages,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending}
        className="self-start border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
      >
        {pending ? "Synchronisation en cours…" : "Synchroniser les images des produits"}
      </button>
      <p className="text-xs text-zinc-400">
        Ajoute à la Médiathèque toute image de produit qui n&apos;y figure
        pas encore (liens externes ré-uploadés, ou images déjà dans notre
        Storage jamais cataloguées).
      </p>
      {state.message ? <p className="text-sm text-green-700">{state.message}</p> : null}
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
