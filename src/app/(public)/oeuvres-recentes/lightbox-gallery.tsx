"use client";

import { useEffect, useRef, useState } from "react";
import { ProtectedImage } from "@/components/protected-image";
import {
  isAdultAge,
  isAgeVerifiedInStorage,
  isValidBirthDate,
  markAgeVerifiedInStorage,
} from "@/lib/age-verification";
import { DateOfBirthFields } from "./date-of-birth-fields";
import { getRecentWorkFullMedia, type RevealedMedia } from "./reveal-actions";

type Work = {
  id: string;
  title: string;
  year: number | null;
  technique: string | null;
  imageUrl: string | null;
  // Vignette plus légère utilisée dans la grille — l'image pleine
  // résolution (imageUrl) n'est chargée que dans la lightbox agrandie.
  // Retombe sur imageUrl si absente (contenu pas encore retraité).
  thumbnailUrl?: string | null;
  kind: "oeuvre" | "photo" | "video";
  videoUrl?: string | null;
  videoEmbedUrl?: string | null;
  // Instagram et TikTok intègrent des formats verticaux (reels/stories) :
  // la lightbox leur donne un cadre portrait plutôt que le 16:9 habituel.
  videoEmbedPortrait?: boolean;
  // Catégorie +18 non encore vérifiée (barrière au niveau de la page,
  // gérée par AgeGate en amont) : imageUrl pointe déjà vers la vignette
  // floutée (ou est nulle) — cet indicateur n'ajoute qu'un repère visuel
  // « verrouillé », il ne floute rien lui-même.
  locked?: boolean;
  // Œuvre marquée +18 individuellement (mélangée dans une grille normale) :
  // déclenche une vérification d'âge au clic, mémorisée en localStorage.
  ageRestricted?: boolean;
};

export function LightboxGallery({ works }: { works: Work[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [verified, setVerified] = useState(() => isAgeVerifiedInStorage());
  const [refused, setRefused] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [revealedById, setRevealedById] = useState<Record<string, RevealedMedia>>({});
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [dobError, setDobError] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  function needsGate(work: Work) {
    return Boolean(work.ageRestricted) && !work.locked && !verified && !revealedById[work.id];
  }

  async function revealWork(work: Work) {
    setRevealing(true);
    const result = await getRecentWorkFullMedia(work.id);
    setRevealing(false);
    if (result) setRevealedById((prev) => ({ ...prev, [work.id]: result }));
  }

  function openAt(index: number) {
    setRefused(false);
    setDobError(null);
    setDay("");
    setMonth("");
    setYear("");
    setOpenIndex(index);
    const work = works[index];
    if (!needsGate(work) && work.ageRestricted && !work.locked && !revealedById[work.id]) {
      void revealWork(work);
    }
  }

  const close = () => setOpenIndex(null);
  const showPrev = () => { if (openIndex !== null) openAt((openIndex - 1 + works.length) % works.length); };
  const showNext = () => { if (openIndex !== null) openAt((openIndex + 1) % works.length); };

  useEffect(() => {
    if (openIndex === null) return;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") showPrev();
      if (event.key === "ArrowRight") showNext();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", handleKeyDown); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIndex, works.length]);

  function handleTouchStart(event: React.TouchEvent) { touchStartX.current = event.touches[0].clientX; }
  function handleTouchEnd(event: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const deltaX = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < 50) return;
    if (deltaX > 0) showPrev(); else showNext();
  }

  function handleConfirmDob(event: React.FormEvent) {
    event.preventDefault();
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);

    if (!isValidBirthDate(d, m, y)) {
      setDobError("Cette date de naissance n'est pas valide.");
      return;
    }
    setDobError(null);

    if (isAdultAge(d, m, y)) {
      markAgeVerifiedInStorage();
      setVerified(true);
      if (openIndex !== null) void revealWork(works[openIndex]);
    } else {
      setRefused(true);
    }
  }

  const current = openIndex !== null ? works[openIndex] : null;
  const currentNeedsGate = current ? needsGate(current) : false;
  const effectiveMedia: RevealedMedia | null = current
    ? (revealedById[current.id] ?? {
        imageUrl: current.imageUrl,
        videoUrl: current.videoUrl ?? null,
        videoEmbedUrl: current.videoEmbedUrl ?? null,
      })
    : null;

  return (
    <>
      <div className="mt-10 columns-1 gap-8 sm:columns-2 lg:columns-3">
        {works.map((work, index) => (
          <button key={work.id} type="button" onClick={() => openAt(index)} className="group mb-8 block w-full break-inside-avoid text-left">
            <div className="relative w-full bg-zinc-50 dark:bg-zinc-900">
              {work.thumbnailUrl ?? work.imageUrl ? (
                <ProtectedImage
                  src={(work.thumbnailUrl ?? work.imageUrl) as string}
                  alt={work.title}
                  className="block h-auto w-full"
                />
              ) : work.locked || work.ageRestricted ? (
                // Aperçu flouté manquant (pas encore régénéré) pour une
                // œuvre +18 : un fond neutre plutôt que le motif de
                // hachures utilisé pour une image réellement absente, pour
                // ne jamais donner l'impression d'une image cassée.
                <div className="flex aspect-square w-full items-center justify-center bg-zinc-900" />
              ) : (
                <div
                  className="aspect-square w-full"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, #f0f0ee 0, #f0f0ee 2px, #ffffff 2px, #ffffff 12px)",
                  }}
                />
              )}
              {work.kind === "video" && !work.locked ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-xl text-white">▶</span>
                </div>
              ) : null}
              {work.locked ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-white">
                    🔒 +18
                  </span>
                </div>
              ) : work.ageRestricted ? (
                <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                  +18
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm font-medium">{work.title}</p>
            <p className="mt-1 text-xs text-zinc-500">{[work.technique, work.year].filter(Boolean).join(" — ")}</p>
          </button>
        ))}
      </div>
      {current ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <button type="button" onClick={close} aria-label="Fermer" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center text-3xl leading-none text-white/80 hover:text-white">×</button>
          {works.length > 1 && !currentNeedsGate ? (<>
            <button type="button" onClick={showPrev} aria-label="Élément précédent" className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center text-3xl text-white/80 hover:text-white sm:left-6">‹</button>
            <button type="button" onClick={showNext} aria-label="Élément suivant" className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center text-3xl text-white/80 hover:text-white sm:right-6">›</button>
          </>) : null}

          {currentNeedsGate ? (
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
                    onClick={close}
                    className="mt-5 w-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                  >
                    Fermer
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold uppercase tracking-wide">
                    Contenu réservé aux adultes
                  </p>
                  <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                    Cette œuvre est marquée comme sensible. Merci de confirmer ta date de naissance
                    pour l&apos;afficher.
                  </p>
                  <form onSubmit={handleConfirmDob} className="mt-5 flex flex-col gap-3">
                    <DateOfBirthFields
                      day={day}
                      month={month}
                      year={year}
                      onDayChange={setDay}
                      onMonthChange={setMonth}
                      onYearChange={setYear}
                    />
                    {dobError ? (
                      <p className="text-xs text-red-600 dark:text-red-400">{dobError}</p>
                    ) : null}
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <button type="button" onClick={close} className="text-sm text-zinc-500 hover:underline">
                        Annuler
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
          ) : revealing ? (
            <div className="flex h-64 w-64 items-center justify-center border border-white/20 text-sm text-white/70">
              Chargement…
            </div>
          ) : effectiveMedia?.videoEmbedUrl ? (
            <div
              className={
                current.videoEmbedPortrait
                  ? "aspect-[9/16] w-full max-w-sm"
                  : "aspect-video w-full max-w-4xl"
              }
            >
              <iframe
                src={effectiveMedia.videoEmbedUrl}
                title={current.title}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          ) : effectiveMedia?.videoUrl ? (
            // Fichier hébergé sur Blac_Kaleta : mêmes réflexes anti-copie que
            // pour les images (pas de bouton téléchargement, clic droit bloqué),
            // même si aucune protection web n'est infaillible côté vidéo.
            <video
              src={effectiveMedia.videoUrl}
              controls
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              onContextMenu={(event) => event.preventDefault()}
              className="max-h-[80vh] max-w-full"
            />
          ) : effectiveMedia?.imageUrl ? (
            <div className="relative">
              <ProtectedImage src={effectiveMedia.imageUrl} alt={current.title} className="max-h-[80vh] max-w-full object-contain" />
              {current.locked ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex items-center gap-1.5 rounded-full bg-black/70 px-4 py-2 text-sm font-medium uppercase tracking-wide text-white">
                    🔒 Contenu +18 — vérifie ton âge
                  </span>
                </div>
              ) : null}
            </div>
          ) : current.locked ? (
            <div className="flex h-64 w-64 items-center justify-center border border-white/20 bg-zinc-900 text-sm text-white/70">
              🔒 Contenu +18
            </div>
          ) : null}

          <div className="mt-4 text-center">
            <p className="text-sm font-medium text-white">{current.title}</p>
            <p className="mt-1 text-xs text-zinc-400">{[current.technique, current.year].filter(Boolean).join(" — ")}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
