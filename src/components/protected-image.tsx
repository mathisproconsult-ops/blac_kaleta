"use client";

import { useState } from "react";

// Couche basique côté navigateur pour les images d'œuvres (le filigrane +
// la version basse résolution côté serveur restent la vraie protection —
// ceci ne fait que gêner le clic droit / glisser-déposer occasionnels).
//
// -webkit-touch-callout:none désactive le menu "Enregistrer l'image" de
// l'appui long sur Safari iOS (contextmenu n'y suffit pas, ce menu est
// natif au système). user-select:none complète pour Android/Chrome, où
// l'appui long déclenche bien un contextmenu classique — géré plus bas.
export function ProtectedImage({
  src,
  alt,
  className,
  priority = false,
  width,
  height,
}: {
  src: string;
  alt: string;
  className?: string;
  // Par défaut, chargement différé (loading="lazy") : l'immense majorité
  // des usages sont des grilles/galeries où la plupart des images sont
  // hors écran au chargement de la page. priority=true réserve le
  // chargement immédiat aux images réellement visibles dès l'arrivée sur
  // la page (ex : les premières de la bannière d'accueil).
  priority?: boolean;
  // Dimensions intrinsèques réelles (en pixels) de l'image, si connues :
  // posées comme attributs HTML width/height, elles indiquent au
  // navigateur le ratio d'aspect avant même que l'image ne soit chargée,
  // pour réserver le bon espace et éviter un décalage visuel (CLS) —
  // utile là où la taille affichée n'est pas fixe (ex : la bannière
  // défilante d'accueil, dont chaque vignette a une largeur différente).
  width?: number | null;
  height?: number | null;
}) {
  const [showNotice, setShowNotice] = useState(false);

  function handleContextMenu(event: React.MouseEvent) {
    event.preventDefault();
    setShowNotice(true);
    window.setTimeout(() => setShowNotice(false), 2000);
  }

  return (
    <div
      className="relative h-full select-none [-webkit-touch-callout:none] [-webkit-user-select:none]"
      onContextMenu={handleContextMenu}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding={priority ? "sync" : "async"}
        width={width ?? undefined}
        height={height ?? undefined}
        className={`${className ?? ""} select-none [-webkit-touch-callout:none] [-webkit-user-select:none]`}
      />
      <div
        className="absolute inset-0 [-webkit-touch-callout:none]"
        onDragStart={(event) => event.preventDefault()}
        onContextMenu={handleContextMenu}
      />
      {showNotice ? (
        <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 px-2 py-1 text-[11px] text-white">
          © Blac_Kaleta — reproduction interdite
        </p>
      ) : null}
    </div>
  );
}
