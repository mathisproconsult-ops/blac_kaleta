"use client";

import { useState } from "react";
import {
  deleteUnusedFiles,
  scanUnusedFiles,
  type UnusedFile,
} from "./storage-cleanup-actions";

type Phase = "idle" | "scanning" | "scanned" | "deleting" | "done" | "error";

const BUCKET = "products";

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} Go`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
  return `${Math.round(bytes / 1024)} Ko`;
}

export function StorageCleanupButton() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<{
    totalFiles: number;
    totalBytes: number;
    unused: UnusedFile[];
    unusedBytes: number;
  } | null>(null);
  const [result, setResult] = useState<{ deleted: number; deletedBytes: number; skipped: number } | null>(null);

  async function startScan() {
    setError(null);
    setResult(null);
    setScan(null);
    setPhase("scanning");
    const response = await scanUnusedFiles(BUCKET);
    if (!response.ok) {
      setError(response.error);
      setPhase("error");
      return;
    }
    setScan(response);
    setPhase("scanned");
  }

  async function startDelete() {
    if (!scan || scan.unused.length === 0) return;
    const confirmed = window.confirm(
      `Supprimer définitivement ${scan.unused.length} fichier(s) inutilisé(s) (${formatSize(scan.unusedBytes)}) ?\n\n` +
        "Ce sont d'anciennes copies que le site n'affiche plus. Les originaux de tes œuvres ne sont pas concernés. " +
        "Cette suppression ne peut pas être annulée.",
    );
    if (!confirmed) return;

    setError(null);
    setPhase("deleting");
    const response = await deleteUnusedFiles(
      BUCKET,
      scan.unused.map((file) => file.name),
    );
    if (!response.ok) {
      setError(response.error);
      setPhase("error");
      return;
    }
    setResult(response);
    setPhase("done");
  }

  const busy = phase === "scanning" || phase === "deleting";

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={startScan}
        disabled={busy}
        className="self-start border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {phase === "scanning" ? "Analyse en cours…" : "Rechercher les fichiers inutilisés"}
      </button>
      <p className="text-xs text-zinc-400">
        Chaque régénération de filigrane ou réparation de qualité crée de
        nouvelles copies d&apos;images sans effacer les anciennes, ce qui
        remplit l&apos;espace de stockage (limité à 1 Go sur l&apos;offre
        gratuite). Cet outil liste les copies publiques que le site
        n&apos;utilise plus, puis les supprime après confirmation. Les
        originaux de tes œuvres ne sont jamais touchés, ni les fichiers
        ajoutés dans les dernières 24 heures.
      </p>

      {phase === "scanned" && scan ? (
        <div className="flex flex-col gap-2 border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
          <p>
            {scan.totalFiles} fichiers au total ({formatSize(scan.totalBytes)}) — dont{" "}
            <strong>
              {scan.unused.length} inutilisé{scan.unused.length > 1 ? "s" : ""} (
              {formatSize(scan.unusedBytes)})
            </strong>
            .
          </p>
          {scan.unused.length > 0 ? (
            <>
              <details>
                <summary className="cursor-pointer text-xs text-zinc-500">Voir la liste</summary>
                <ul className="mt-1 max-h-48 overflow-y-auto text-xs text-zinc-500">
                  {scan.unused.map((file) => (
                    <li key={file.name}>
                      {file.name} — {formatSize(file.size)}
                    </li>
                  ))}
                </ul>
              </details>
              <button
                type="button"
                onClick={startDelete}
                className="self-start border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
              >
                Supprimer ces {scan.unused.length} fichiers ({formatSize(scan.unusedBytes)})
              </button>
            </>
          ) : (
            <p className="text-green-700 dark:text-green-300">✓ Rien à nettoyer.</p>
          )}
        </div>
      ) : null}

      {phase === "deleting" ? (
        <p className="text-sm text-zinc-500">Suppression en cours… ne ferme pas la page.</p>
      ) : null}

      {phase === "done" && result ? (
        <p className="border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          ✓ {result.deleted} fichier{result.deleted > 1 ? "s" : ""} supprimé
          {result.deleted > 1 ? "s" : ""} ({formatSize(result.deletedBytes)} libérés)
          {result.skipped > 0 ? ` — ${result.skipped} conservé(s) car de nouveau utilisé(s).` : "."}
        </p>
      ) : null}

      {phase === "error" && error ? (
        <p className="border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          ⚠ {error}
        </p>
      ) : null}
    </div>
  );
}
