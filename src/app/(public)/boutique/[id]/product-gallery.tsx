"use client";

import { useState } from "react";
import { ProtectedImage } from "@/components/protected-image";

export function ProductGallery({
  images,
  alt,
  protectImages = true,
}: {
  images: { url: string }[];
  alt: string;
  protectImages?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const main = images[selected];

  return (
    <div>
      <div className="aspect-[3/4] w-full bg-zinc-50 dark:bg-zinc-900">
        {main ? (
          protectImages ? (
            <ProtectedImage src={main.url} alt={alt} className="h-full w-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={main.url} alt={alt} className="h-full w-full object-cover" />
          )
        ) : (
          <div
            className="h-full w-full"
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
              <img src={image.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
