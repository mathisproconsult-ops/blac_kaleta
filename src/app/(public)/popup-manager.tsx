"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { ActivePopup } from "@/lib/popups";

function matchesScope(popup: ActivePopup, pathname: string) {
  if (popup.scope === "all") return true;
  if (popup.scope === "home") return pathname === "/";
  return popup.scope_page_path === pathname;
}

function storageKey(popup: ActivePopup) {
  return `blac-kaleta-popup-${popup.id}`;
}

// "once" est mémorisé en localStorage (ne réapparaît plus jamais une fois
// vue), "every_session" en sessionStorage (réapparaît à chaque nouvelle
// session de navigation — le stockage de session se vide de lui-même à la
// fermeture de l'onglet/du navigateur).
function popupStorage(popup: ActivePopup): Storage | null {
  try {
    return popup.frequency === "once" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function hasBeenSeen(popup: ActivePopup): boolean {
  const storage = popupStorage(popup);
  if (!storage) return false;
  try {
    return storage.getItem(storageKey(popup)) === "1";
  } catch {
    return false;
  }
}

function markSeen(popup: ActivePopup) {
  const storage = popupStorage(popup);
  if (!storage) return;
  try {
    storage.setItem(storageKey(popup), "1");
  } catch {
    // Rien à faire : la popup réapparaîtra simplement la prochaine fois.
  }
}

export function PopupManager({ popups }: { popups: ActivePopup[] }) {
  const pathname = usePathname();
  const [active, setActive] = useState<ActivePopup | null>(null);

  useEffect(() => {
    const match = popups.find((popup) => matchesScope(popup, pathname) && !hasBeenSeen(popup));
    // La correspondance dépend du localStorage/sessionStorage (lu par
    // hasBeenSeen), indisponible côté serveur : impossible de la dériver
    // directement du rendu sans provoquer un décalage d'hydratation, d'où
    // cet effet plutôt qu'un calcul synchrone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(match ?? null);
  }, [pathname, popups]);

  if (!active) return null;

  function close() {
    if (active) markSeen(active);
    setActive(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={close}
    >
      <div
        className="relative w-full max-w-sm border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          className="absolute right-4 top-4 text-2xl leading-none text-zinc-400 hover:text-black dark:hover:text-zinc-100"
        >
          ×
        </button>
        {active.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={active.image_url} alt="" className="mb-4 h-40 w-full object-cover" />
        ) : null}
        <p className="pr-6 text-sm font-semibold uppercase tracking-wide">{active.title}</p>
        <p className="mt-3 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">
          {active.body}
        </p>
        {active.button_text && active.button_url ? (
          <a
            href={active.button_url}
            onClick={close}
            className="mt-5 inline-block bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {active.button_text}
          </a>
        ) : null}
      </div>
    </div>
  );
}
