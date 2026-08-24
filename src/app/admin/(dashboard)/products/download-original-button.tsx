"use client";

import { useState, useTransition } from "react";
import { getOriginalImageDownloadUrl } from "./actions";

export function DownloadOriginalButton({ originalPath }: { originalPath: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await getOriginalImageDownloadUrl(originalPath);
      if (result.error || !result.url) {
        setError(result.error ?? "Erreur inconnue.");
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="absolute -left-2 -top-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-label="Télécharger l'original"
        title="Télécharger l'original (haute résolution, sans filigrane)"
        className="flex h-5 w-5 items-center justify-center bg-white text-xs text-zinc-700 shadow disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-200"
      >
        ⭳
      </button>
      {error ? (
        <p className="absolute left-0 top-6 w-32 bg-red-50 p-1 text-[10px] text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
