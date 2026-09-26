"use client";

import { useState } from "react";
import {
  listWorksNeedingBlur,
  backfillOneWork,
  revalidateAfterBlurBackfill,
  type BlurWorkRef,
} from "./backfill-blur-actions";

type Phase = "idle" | "running" | "done" | "error";

type FailedWork = { kind: "media" | "product"; id: number; message: string };

export function BackfillBlurButton() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [total, setTotal] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [tally, setTally] = useState({ done: 0, skipped: 0, error: 0 });
  const [failures, setFailures] = useState<FailedWork[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setPhase("running");
    setProcessed(0);
    setTally({ done: 0, skipped: 0, error: 0 });
    setFailures([]);

    const { works, error: listError } = await listWorksNeedingBlur();
    if (listError) {
      setError("Erreur base de données : " + listError);
      setPhase("error");
      return;
    }

    setTotal(works.length);

    if (works.length === 0) {
      setPhase("done");
      return;
    }

    const finalTally = { done: 0, skipped: 0, error: 0 };
    const finalFailures: FailedWork[] = [];
    for (const [index, work] of (works as BlurWorkRef[]).entries()) {
      const result = await backfillOneWork(work);
      finalTally[result.status] += 1;
      if (result.status === "error") {
        finalFailures.push({
          kind: work.kind,
          id: work.id,
          message: result.message ?? "Erreur inconnue.",
        });
        setFailures([...finalFailures]);
      }
      setTally({ ...finalTally });
      setProcessed(index + 1);
    }

    await revalidateAfterBlurBackfill(works.map((work) => work.categoryId));
    setPhase("done");
  }

  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={start}
        disabled={phase === "running"}
        className="self-start border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {phase === "running" ? "Régénération en cours…" : "Régénérer les floutages manquants"}
      </button>
      <p className="text-xs text-zinc-400">
        Génère l&apos;aperçu flouté des œuvres +18 (individuellement ou via
        leur catégorie) qui n&apos;en ont pas encore — répare l&apos;affichage
        cassé (motif de hachures) sans toucher aux œuvres déjà correctement
        traitées. Peut être relancé sans risque.
      </p>

      {phase === "running" || (phase === "done" && total > 0) ? (
        <div className="flex flex-col gap-1">
          <div className="h-2 w-full max-w-sm bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-2 bg-black transition-all duration-200 dark:bg-zinc-100"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            {processed} / {total} œuvre{total > 1 ? "s" : ""} ({percent}%)
          </p>
        </div>
      ) : null}

      {phase === "done" ? (
        <p className="border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          {total === 0
            ? "✓ Rien à régénérer — tout est déjà en ordre."
            : `✓ Terminé — ${tally.done} régénérée${tally.done > 1 ? "s" : ""}, ${tally.skipped} ignorée${tally.skipped > 1 ? "s" : ""}, ${tally.error} échec${tally.error > 1 ? "s" : ""}.`}
        </p>
      ) : null}

      {failures.length > 0 ? (
        <div className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">Œuvres en échec :</p>
          <ul className="mt-1 flex flex-col gap-1">
            {failures.map((failure) => (
              <li key={`${failure.kind}-${failure.id}`}>
                {failure.kind === "media" ? "Média" : "Produit"} #{failure.id} — {failure.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {phase === "error" && error ? (
        <p className="border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          ⚠ {error}
        </p>
      ) : null}
    </div>
  );
}
