"use client";

import { useState } from "react";
import {
  listQualityRepairCandidates,
  checkImageForDoubleCompression,
  repairImage,
  revalidateAfterQualityRepair,
  type RepairImageRef,
  type CheckResult,
  type CheckStatus,
} from "./quality-repair-actions";

type Phase = "idle" | "detecting" | "detected" | "repairing" | "repaired" | "error";

export function QualityRepairButton() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [total, setTotal] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [repairProcessed, setRepairProcessed] = useState(0);
  const [repairTally, setRepairTally] = useState({ done: 0, error: 0 });
  const [repairFailures, setRepairFailures] = useState<{ title: string; message: string }[]>([]);

  async function detect() {
    setError(null);
    setPhase("detecting");
    setProcessed(0);
    setResults([]);

    const { images, error: listError } = await listQualityRepairCandidates();
    if (listError) {
      setError("Erreur base de données : " + listError);
      setPhase("error");
      return;
    }

    setTotal(images.length);

    const finalResults: CheckResult[] = [];
    for (const [index, image] of (images as RepairImageRef[]).entries()) {
      const result = await checkImageForDoubleCompression(image);
      finalResults.push(result);
      setResults([...finalResults]);
      setProcessed(index + 1);
    }

    setPhase("detected");
  }

  async function repair() {
    setPhase("repairing");
    setRepairProcessed(0);
    setRepairTally({ done: 0, error: 0 });
    setRepairFailures([]);

    const candidates = results.filter(
      (r) => r.status === "candidate_clean_source" || r.status === "candidate_needs_media_lookup",
    );

    const finalTally = { done: 0, error: 0 };
    const finalFailures: { title: string; message: string }[] = [];
    for (const [index, candidate] of candidates.entries()) {
      const result = await repairImage({ id: candidate.imageId }, candidate.status as CheckStatus);
      if (result.status === "error") {
        finalTally.error += 1;
        finalFailures.push({ title: result.title, message: result.message ?? "Erreur inconnue." });
        setRepairFailures([...finalFailures]);
      } else {
        finalTally.done += 1;
      }
      setRepairTally({ ...finalTally });
      setRepairProcessed(index + 1);
    }

    await revalidateAfterQualityRepair();
    setPhase("repaired");
  }

  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
  const candidates = results.filter(
    (r) => r.status === "candidate_clean_source" || r.status === "candidate_needs_media_lookup",
  );
  const unrecoverable = results.filter((r) => r.status === "candidate_unrecoverable");
  const checkErrors = results.filter((r) => r.status === "error");
  const confirmedCount = candidates.filter((r) => r.dimensionsMatch).length;
  const repairCandidatesTotal = candidates.length;
  const repairPercent =
    repairCandidatesTotal > 0 ? Math.round((repairProcessed / repairCandidatesTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={detect}
        disabled={phase === "detecting" || phase === "repairing"}
        className="self-start border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {phase === "detecting" ? "Détection en cours…" : "1. Vérifier toutes les photos de produits"}
      </button>
      <p className="text-xs text-zinc-400">
        Vérifie, pour chaque photo de produit, la fiabilité de l&apos;original
        jamais retouché conservé en réserve — et prépare une régénération
        propre en un seul passage depuis cet original pour toutes (le
        refaire ne coûte rien, l&apos;original n&apos;est jamais modifié),
        même quand un redimensionnement normal masque une éventuelle
        double compression passée. Les images dont les dimensions actuelles
        sont identiques à l&apos;original (comme &quot;Croisement&quot;)
        sont signalées à part : c&apos;est un signe confirmé, pas juste
        préventif. Ne modifie rien tant que la réparation n&apos;est pas
        lancée : lecture seule.
      </p>

      {phase === "detecting" || phase === "detected" || phase === "repairing" || phase === "repaired" ? (
        <div className="flex flex-col gap-1">
          <div className="h-2 w-full max-w-sm bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-2 bg-black transition-all duration-200 dark:bg-zinc-100"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            {processed} / {total} image{total > 1 ? "s" : ""} analysée{total > 1 ? "s" : ""} ({percent}%)
          </p>
        </div>
      ) : null}

      {phase === "detected" || phase === "repairing" || phase === "repaired" ? (
        <div className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-medium">
            ✓ Détection terminée — {candidates.length} image{candidates.length > 1 ? "s" : ""} sur {total} seront
            régénérées par précaution.
          </p>
          <p className="mt-1 text-xs">
            Dont {confirmedCount} confirmée{confirmedCount > 1 ? "s" : ""}{" "}
            (même signe que &quot;Croisement&quot; — dimensions inchangées) et{" "}
            {candidates.length - confirmedCount} en passage préventif (redimensionnées, double
            compression ni confirmée ni exclue).
          </p>
          <p className="mt-1 text-xs">
            {results.filter((r) => r.status === "candidate_clean_source").length} réparable
            {results.filter((r) => r.status === "candidate_clean_source").length > 1 ? "s" : ""}{" "}
            directement depuis l&apos;original, et{" "}
            {results.filter((r) => r.status === "candidate_needs_media_lookup").length} via la Médiathèque.
          </p>
          {confirmedCount > 0 ? (
            <ul className="mt-2 max-h-40 overflow-y-auto text-xs">
              {candidates
                .filter((c) => c.dimensionsMatch)
                .map((c) => (
                  <li key={c.imageId}>
                    {c.title} — confirmée (
                    {c.status === "candidate_clean_source" ? "original fiable" : "via Médiathèque"})
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {unrecoverable.length > 0 && (phase === "detected" || phase === "repairing" || phase === "repaired") ? (
        <div className="border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          <p className="font-medium">
            {unrecoverable.length} image{unrecoverable.length > 1 ? "s" : ""} suspecte
            {unrecoverable.length > 1 ? "s" : ""} mais non réparable automatiquement :
          </p>
          <ul className="mt-1">
            {unrecoverable.map((c) => (
              <li key={c.imageId}>
                {c.title} — {c.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {checkErrors.length > 0 && (phase === "detected" || phase === "repairing" || phase === "repaired") ? (
        <div className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">
            {checkErrors.length} image{checkErrors.length > 1 ? "s" : ""} n&apos;a pas pu être vérifiée :
          </p>
          <ul className="mt-1">
            {checkErrors.map((c) => (
              <li key={c.imageId}>
                {c.title} — {c.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {phase === "detected" && candidates.length > 0 ? (
        <button
          type="button"
          onClick={repair}
          className="self-start bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          2. Régénérer ces {candidates.length} image{candidates.length > 1 ? "s" : ""} depuis l&apos;original
        </button>
      ) : null}

      {phase === "repairing" || phase === "repaired" ? (
        <div className="flex flex-col gap-1">
          <div className="h-2 w-full max-w-sm bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-2 bg-green-600 transition-all duration-200"
              style={{ width: `${repairPercent}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            Réparation : {repairProcessed} / {repairCandidatesTotal} ({repairPercent}%)
          </p>
        </div>
      ) : null}

      {phase === "repaired" ? (
        <p className="border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          ✓ Terminé — {repairTally.done} réparée{repairTally.done > 1 ? "s" : ""}, {repairTally.error} échec
          {repairTally.error > 1 ? "s" : ""}.
        </p>
      ) : null}

      {repairFailures.length > 0 ? (
        <div className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">Réparations en échec :</p>
          <ul className="mt-1">
            {repairFailures.map((f, i) => (
              <li key={i}>
                {f.title} — {f.message}
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
