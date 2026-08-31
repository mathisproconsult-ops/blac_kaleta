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
}: {
  src: string;
  alt: string;
  className?: string;
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
