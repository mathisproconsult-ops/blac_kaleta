"use client";

import { useEffect, useRef, useState } from "react";
import { ProtectedImage } from "@/components/protected-image";

type Work = {
  id: string;
  title: string;
  year: number | null;
  technique: string | null;
  imageUrl: string | null;
  kind: "oeuvre" | "photo" | "video";
  videoUrl?: string | null;
  videoEmbedUrl?: string | null;
};

export function LightboxGallery({ works }: { works: Work[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const close = () => setOpenIndex(null);
  const showPrev = () => setOpenIndex((current) => (current === null ? null : (current - 1 + works.length) % works.length));
  const showNext = () => setOpenIndex((current) => (current === null ? null : (current + 1) % works.length));
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
  }, [openIndex, works.length]);
  function handleTouchStart(event: React.TouchEvent) { touchStartX.current = event.touches[0].clientX; }
  function handleTouchEnd(event: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const deltaX = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < 50) return;
    if (deltaX > 0) showPrev(); else showNext();
  }
  const current = openIndex !== null ? works[openIndex] : null;
  return (
    <>
      <div className="mt-10 columns-1 gap-8 sm:columns-2 lg:columns-3">
        {works.map((work, index) => (
          <button key={work.id} type="button" onClick={() => setOpenIndex(index)} className="group mb-8 block w-full break-inside-avoid text-left">
            <div className="relative w-full bg-zinc-50 dark:bg-zinc-900">
              {work.imageUrl ? <ProtectedImage src={work.imageUrl} alt={work.title} className="block h-auto w-full" /> : <div className="aspect-square w-full" style={{ backgroundImage: "repeating-linear-gradient(45deg, #f0f0ee 0, #f0f0ee 2px, #ffffff 2px, #ffffff 12px)" }} />}
              {work.kind === "video" ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-xl text-white">▶</span>
                </div>
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
          {works.length > 1 ? (<>
            <button type="button" onClick={showPrev} aria-label="Élément précédent" className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center text-3xl text-white/80 hover:text-white sm:left-6">‹</button>
            <button type="button" onClick={showNext} aria-label="Élément suivant" className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center text-3xl text-white/80 hover:text-white sm:right-6">›</button>
          </>) : null}
          {current.kind === "video" && current.videoEmbedUrl ? (
            <div className="aspect-video w-full max-w-4xl">
              <iframe
                src={current.videoEmbedUrl}
                title={current.title}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          ) : current.kind === "video" && current.videoUrl ? (
            // Fichier hébergé sur Blac_Kaleta : mêmes réflexes anti-copie que
            // pour les images (pas de bouton téléchargement, clic droit bloqué),
            // même si aucune protection web n'est infaillible côté vidéo.
            <video
              src={current.videoUrl}
              controls
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              onContextMenu={(event) => event.preventDefault()}
              className="max-h-[80vh] max-w-full"
            />
          ) : current.imageUrl ? (
            <ProtectedImage src={current.imageUrl} alt={current.title} className="max-h-[80vh] max-w-full object-contain" />
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
