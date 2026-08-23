"use client";

import { useEffect, useState } from "react";
import { FaMoon, FaSun } from "react-icons/fa6";

const THEME_CHANGE_EVENT = "blackaleta:theme-change";

export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Synchronise avec la classe posée avant hydratation par le script
    // anti-FOUC (voir src/app/layout.tsx) — impossible à connaître au rendu
    // serveur puisqu'elle dépend de localStorage/preférence système.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(document.documentElement.classList.contains("dark"));

    // Plusieurs boutons peuvent être montés en même temps (header public +
    // sidebar admin) : sans cet écouteur, cliquer sur l'un ne met pas
    // l'icône de l'autre à jour.
    function handleThemeChange(event: Event) {
      setIsDark((event as CustomEvent<boolean>).detail);
    }
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Stockage indisponible (navigation privée...) : le choix ne persiste
      // pas mais le bouton reste fonctionnel pour la session en cours.
    }
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: next }));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Activer le mode clair" : "Activer le mode sombre"}
      title={isDark ? "Mode clair" : "Mode sombre"}
      className={
        className ??
        "flex h-9 w-9 flex-none items-center justify-center rounded-full text-lg text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
      }
    >
      {isDark ? <FaSun /> : <FaMoon />}
    </button>
  );
}
