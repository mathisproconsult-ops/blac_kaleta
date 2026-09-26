"use client";

import { useActionState } from "react";
import {
  regenerateBlurAction,
  type BlurWorkRef,
  type RegenerateBlurState,
} from "./backfill-blur-actions";

const initialState: RegenerateBlurState = { status: "idle", message: null };

// Affiche le résultat réel de la régénération (réussie / ignorée / en
// échec) au lieu de rester muet — indispensable pour diagnostiquer un cas
// comme "toujours pareil" après un clic : sans ce retour, impossible de
// savoir si le clic a vraiment recréé un fichier ou n'a rien fait.
export function RegenerateBlurButton({ work }: { work: BlurWorkRef }) {
  const [state, formAction, pending] = useActionState(
    regenerateBlurAction.bind(null, work),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-zinc-500 hover:underline disabled:opacity-50 dark:text-zinc-400"
      >
        {pending ? "Régénération…" : "Régénérer le floutage"}
      </button>
      {state.status === "done" ? (
        <p className="text-xs text-green-600 dark:text-green-400">✓ Régénéré.</p>
      ) : null}
      {state.status === "skipped" ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          ⚠ Ignoré — {state.message ?? "raison inconnue."}
        </p>
      ) : null}
      {state.status === "error" ? (
        <p className="text-xs text-red-600 dark:text-red-400">
          ✗ Échec — {state.message ?? "erreur inconnue."}
        </p>
      ) : null}
    </form>
  );
}
