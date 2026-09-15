"use client";

import { useState } from "react";
import { getDigitalBookDownloadUrl } from "./actions";

export function DownloadBookButton({ token, orderItemId }: { token: string; orderItemId: number }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    const result = await getDigitalBookDownloadUrl(token, orderItemId);
    setPending(false);
    if (result.url) {
      window.location.href = result.url;
    } else {
      setError(result.error ?? "Erreur inconnue.");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="self-start bg-black px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? "Préparation…" : "Télécharger le PDF"}
      </button>
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
