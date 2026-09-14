"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => CURRENT_YEAR - i);

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

function computeAge(day: number, month: number, year: number): number {
  const today = new Date();
  const hadBirthdayThisYear =
    today.getMonth() > month - 1 || (today.getMonth() === month - 1 && today.getDate() >= day);
  return today.getFullYear() - year - (hadBirthdayThisYear ? 0 : 1);
}

// Barrière d'âge côté client : mémorise la vérification dans un cookie (lu
// par le composant serveur de la page pour décider quelles URLs — floutées
// ou nettes — envoyer), pas seulement dans le localStorage. C'est un filtre
// de bonne foi, pas une vérification d'identité : une date de naissance
// déclarée peut toujours être fausse, comme sur la plupart des sites.
export function AgeGate({
  categoryId,
  locked,
  children,
}: {
  categoryId: number;
  locked: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(locked);
  const [refused, setRefused] = useState(false);
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleLeave() {
    router.push("/oeuvres-recentes");
  }

  function handleConfirm(event: React.FormEvent) {
    event.preventDefault();
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);

    if (!d || !m || !y) {
      setError("Merci de renseigner une date de naissance complète.");
      return;
    }

    const parsed = new Date(y, m - 1, d);
    const isValidDate =
      parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
    if (!isValidDate || parsed > new Date()) {
      setError("Cette date de naissance n'est pas valide.");
      return;
    }

    setError(null);

    if (computeAge(d, m, y) >= 18) {
      document.cookie = `av_cat_${categoryId}=1; max-age=${THIRTY_DAYS_SECONDS}; path=/; samesite=lax`;
      setOpen(false);
      router.refresh();
    } else {
      setRefused(true);
    }
  }

  return (
    <>
      {children}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            {refused ? (
              <>
                <p className="text-sm font-semibold uppercase tracking-wide">Accès non autorisé</p>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  Ce contenu est réservé aux personnes majeures. D&apos;après la date renseignée, tu
                  n&apos;as pas encore 18 ans.
                </p>
                <button
                  type="button"
                  onClick={handleLeave}
                  className="mt-5 w-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  Retour à Œuvres récentes
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold uppercase tracking-wide">
                  Contenu réservé aux adultes
                </p>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  Cette catégorie contient du contenu sensible. Merci de confirmer ta date de
                  naissance pour y accéder.
                </p>
                <form onSubmit={handleConfirm} className="mt-5 flex flex-col gap-3">
                  <div className="flex gap-2">
                    <select
                      value={day}
                      onChange={(event) => setDay(event.target.value)}
                      required
                      aria-label="Jour de naissance"
                      className="flex-1 border border-zinc-300 px-2 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
                    >
                      <option value="">Jour</option>
                      {DAYS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <select
                      value={month}
                      onChange={(event) => setMonth(event.target.value)}
                      required
                      aria-label="Mois de naissance"
                      className="flex-1 border border-zinc-300 px-2 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
                    >
                      <option value="">Mois</option>
                      {MONTHS.map((label, index) => (
                        <option key={label} value={index + 1}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={year}
                      onChange={(event) => setYear(event.target.value)}
                      required
                      aria-label="Année de naissance"
                      className="flex-1 border border-zinc-300 px-2 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-100"
                    >
                      <option value="">Année</option>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  {error ? (
                    <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                  ) : null}
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handleLeave}
                      className="text-sm text-zinc-500 hover:underline"
                    >
                      Quitter
                    </button>
                    <button
                      type="submit"
                      className="bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    >
                      Confirmer
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
