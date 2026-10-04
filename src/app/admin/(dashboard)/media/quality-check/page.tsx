import type { Metadata } from "next";
import { checkImageQuality } from "./actions";

export const metadata: Metadata = {
  title: "Vérification qualité — Admin Blac_Kaleta",
};

// Page de diagnostic temporaire (pas de lien dans le menu) : compare le
// fichier actuellement publié à l'original jamais retouché pour quelques
// images représentatives du lot importé le 22 juillet, afin de vérifier si
// une perte de qualité réelle s'est produite avant de construire un outil
// de réparation. À supprimer une fois l'investigation terminée.
const SAMPLE_IMAGE_IDS = [103, 115, 125, 130];

function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} Ko`;
}

export default async function QualityCheckPage() {
  const results = await Promise.all(SAMPLE_IMAGE_IDS.map((id) => checkImageQuality(id)));

  return (
    <div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Vérification qualité — fichier actuel vs original
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Compare, pour {SAMPLE_IMAGE_IDS.length} images du lot importé le 22
        juillet, le fichier actuellement affiché sur le site au fichier
        original jamais retouché dans le stockage privé. Les vignettes
        montrent un détail recadré à taille native (sans mise à l&apos;échelle)
        pour rendre une éventuelle perte de netteté visible directement.
      </p>

      <div className="mt-8 flex flex-col gap-10">
        {results.map((result) => (
          <div key={result.imageId} className="border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-lg font-medium">
              {result.title} <span className="text-sm text-zinc-400">(image #{result.imageId})</span>
            </h2>

            {result.error ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">⚠ {result.error}</p>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Fichier actuel (publié sur le site)
                </p>
                {result.current ? (
                  <>
                    <p className="mt-1 text-sm">
                      {result.current.width} × {result.current.height}px — {formatBytes(result.current.bytes)}
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.current.cropDataUrl}
                      alt="Détail recadré — fichier actuel"
                      className="mt-2 border border-zinc-300 dark:border-zinc-700"
                      width={240}
                      height={240}
                    />
                  </>
                ) : (
                  <p className="mt-1 text-sm text-zinc-400">Indisponible</p>
                )}
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Original (jamais retouché, stockage privé)
                </p>
                {result.original ? (
                  <>
                    <p className="mt-1 text-sm">
                      {result.original.width} × {result.original.height}px — {formatBytes(result.original.bytes)}
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.original.cropDataUrl}
                      alt="Détail recadré — original"
                      className="mt-2 border border-zinc-300 dark:border-zinc-700"
                      width={240}
                      height={240}
                    />
                  </>
                ) : (
                  <p className="mt-1 text-sm text-zinc-400">Indisponible</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
