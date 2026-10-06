"use client";

import { useState } from "react";
import { ProtectedImage } from "@/components/protected-image";

export function ProductGallery({
  images,
  alt,
  protectImages = true,
}: {
  images: { url: string; highQualityUrl?: string; width?: number | null; height?: number | null }[];
  alt: string;
  protectImages?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const main = images[selected];
  // Image agrandie affichée en haute résolution (Paramètres → Qualité des
  // images) — repli sur la taille principale si absente (photo pas encore
  // retraitée depuis la migration 0043). La bande de vignettes ci-dessous
  // continue d'utiliser la taille principale, bien suffisante à 64x64px.
  const mainSrc = main?.highQualityUrl ?? main?.url;

  return (
    <div>
      {/* Pas de fond coloré ni de largeur imposée au-delà de la mise en
          page : le cadre épouse exactement le ratio réel de l'image
          affichée (portrait, paysage, carré, panoramique...). Avec un fond
          plein sur un conteneur w-full, une image plus étroite que la
          colonne (portrait) se retrouvait centrée dans une boîte visible
          plus large qu'elle — des bandes grises sur les côtés. */}
      <div className="flex w-full items-center justify-center">
        {main && mainSrc ? (
          protectImages ? (
            <ProtectedImage
              src={mainSrc}
              alt={alt}
              className="max-h-[70vh] w-auto max-w-full object-contain"
              priority
              width={main.width}
              height={main.height}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mainSrc} alt={alt} className="max-h-[70vh] w-auto max-w-full object-contain" />
          )
        ) : (
          <div
            className="aspect-square w-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, #f0f0ee 0, #f0f0ee 2px, #ffffff 2px, #ffffff 12px)",
            }}
          />
        )}
      </div>
      {images.length > 1 ? (
        <div className="mt-3 flex gap-2">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setSelected(index)}
              className={
                index === selected
                  ? "h-16 w-16 border-2 border-black dark:border-zinc-100"
                  : "h-16 w-16 border border-zinc-200 dark:border-zinc-800"
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
