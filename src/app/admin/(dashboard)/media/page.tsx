import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { deleteMedia, toggleMediaRecentWorks, uploadMedia } from "./actions";

export const metadata: Metadata = {
  title: "Médiathèque — Admin Blac_Kaleta",
};

type MediaRow = {
  id: number;
  filename: string;
  path: string;
  url: string;
  kind: "image" | "gif" | "pdf" | "other";
  product_id: number | null;
  products: { id: number; title: string; show_in_recent_works: boolean } | null;
};

export default async function MediaPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media")
    .select(
      "id, filename, path, url, kind, product_id, products(id, title, show_in_recent_works)",
    )
    .order("created_at", { ascending: false })
    .returns<MediaRow[]>();

  const mediaList = data ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Médiathèque
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Tous les fichiers uploadés (images, gifs, pdf), réutilisables pour
        n&apos;importe quelle œuvre.
      </p>

      <form
        action={uploadMedia}
        className="mt-6 flex flex-wrap items-center gap-3 border border-zinc-200 bg-white p-4"
      >
        <input
          type="file"
          name="files"
          accept="image/*,application/pdf"
          multiple
          className="text-sm"
        />
        <button
          type="submit"
          className="bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Uploader
        </button>
      </form>

      {error ? (
        <p className="mt-4 text-sm text-red-600">
          Erreur de chargement : {error.message}
        </p>
      ) : null}

      {mediaList.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucun fichier pour l&apos;instant.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {mediaList.map((media) => (
            <div key={media.id} className="border border-zinc-200 bg-white p-3">
              <div className="flex aspect-square items-center justify-center bg-zinc-50">
                {media.kind === "image" || media.kind === "gif" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={media.url}
                    alt={media.filename}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs uppercase tracking-wide text-zinc-400">
                    {media.kind}
                  </span>
                )}
              </div>
              <p className="mt-2 truncate text-xs text-zinc-600" title={media.filename}>
                {media.filename}
              </p>
              <p className="truncate text-xs text-zinc-400">
                {media.products ? media.products.title : "Non utilisée"}
              </p>
              <label
                className={
                  media.product_id
                    ? "mt-2 flex items-center gap-2 text-xs"
                    : "mt-2 flex items-center gap-2 text-xs text-zinc-400"
                }
                title={
                  media.product_id
                    ? undefined
                    : "Associe ce fichier à une œuvre pour l'afficher dans Œuvres récentes"
                }
              >
                {media.product_id && media.products ? (
                  <form
                    action={toggleMediaRecentWorks.bind(
                      null,
                      media.products.id,
                      media.products.show_in_recent_works,
                    )}
                  >
                    <button
                      type="submit"
                      className={
                        media.products.show_in_recent_works
                          ? "rounded bg-[#eef4ec] px-2 py-1 text-xs font-medium text-[#3a6b3a]"
                          : "rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-500"
                      }
                    >
                      {media.products.show_in_recent_works
                        ? "Dans Œuvres récentes"
                        : "Ajouter à Œuvres récentes"}
                    </button>
                  </form>
                ) : (
                  <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-400">
                    Œuvres récentes
                  </span>
                )}
              </label>
              <form action={deleteMedia.bind(null, media.id, media.path)} className="mt-2">
                <button type="submit" className="text-xs text-red-600 hover:underline">
                  Supprimer
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
