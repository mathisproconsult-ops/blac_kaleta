"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isAdultAge, isValidBirthDate } from "@/lib/age-verification";
import { DateOfBirthFields } from "./date-of-birth-fields";

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

// Barrière d'âge au niveau catégorie : mémorise la vérification dans un
// cookie (lu par le composant serveur de la page pour décider quelles URLs
// — floutées ou nettes — envoyer), pas seulement dans le localStorage. Ce
// n'est pas une vérification d'identité : une date de naissance déclarée
// peut toujours être fausse, comme sur la plupart des sites.
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

    if (!isValidBirthDate(d, m, y)) {
      setError("Cette date de naissance n'est pas valide.");
      return;
    }

    setError(null);

    if (isAdultAge(d, m, y)) {
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
                  <DateOfBirthFields
                    day={day}
                    month={month}
                    year={year}
                    onDayChange={setDay}
                    onMonthChange={setMonth}
                    onYearChange={setYear}
                  />
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
