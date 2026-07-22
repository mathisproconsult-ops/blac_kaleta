import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Disclosure } from "@/components/disclosure";
import { SubmitButton } from "@/components/submit-button";
import { MediaFilters, MediaViewToggle } from "./media-filters";
import { MediaUploadField } from "./media-upload-field";
import { attachUploadedMedia, deleteMedia, toggleMediaRecentWorks } from "./actions";

export const metadata: Metadata = {
  title: "Médiathèque — Admin Blac_Kaleta",
};

type MediaRow = {
  id: number;
  filename: string;
  path: string;
  url: string;
  kind: "image" | "gif" | "pdf" | "other";
  created_at: string;
  product_id: number | null;
  products: { id: number; title: string; show_in_recent_works: boolean } | null;
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const monthFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

function monthKey(isoDate: string) {
  return isoDate.slice(0, 7);
}

function monthBounds(key: string) {
  const [year, month] = key.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{
    recherche?: string;
    type?: string;
    date?: string;
    vue?: string;
  }>;
}) {
  const {
    recherche = "",
    type = "tous",
    date = "toutes",
    vue = "grille",
  } = await searchParams;
  const view = vue === "liste" ? "liste" : "grille";
  const supabase = await createClient();

  let query = supabase
    .from("media")
    .select(
      "id, filename, path, url, kind, created_at, product_id, products(id, title, show_in_recent_works)",
    )
    .order("created_at", { ascending: false });

  if (type !== "tous") {
    query = query.eq("kind", type);
  }
  if (recherche.trim()) {
    query = query.ilike("filename", `%${recherche.trim()}%`);
  }
  if (date !== "toutes") {
    const { start, end } = monthBounds(date);
    query = query.gte("created_at", start).lt("created_at", end);
  }

  const [{ data, error }, { data: allDates }] = await Promise.all([
    query.returns<MediaRow[]>(),
    supabase.from("media").select("created_at"),
  ]);

  const mediaList = data ?? [];

  const dateOptions = Array.from(
    new Set((allDates ?? []).map((row) => monthKey(row.created_at))),
  )
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({
      value: key,
      label: capitalize(monthFormatter.format(new Date(`${key}-01`))),
    }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold uppercase tracking-wide">
          Médiathèque
        </h1>
        <Disclosure label="+ Ajouter un fichier média" closeLabel="Fermer">
          <form
            action={attachUploadedMedia}
            className="flex flex-wrap items-center gap-3 border border-zinc-200 bg-white p-4"
          >
            <MediaUploadField />
            <SubmitButton
              pendingText="Ajout…"
              className="bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Ajouter à la Médiathèque
            </SubmitButton>
          </form>
        </Disclosure>
      </div>
      <p className="mt-2 text-sm text-zinc-600">
        Tous les fichiers uploadés (images, gifs, pdf), réutilisables pour
        n&apos;importe quel produit.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <MediaFilters
          search={recherche}
          kind={type}
          date={date}
          dateOptions={dateOptions}
        />
        <MediaViewToggle view={view} />
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600">
          Erreur de chargement : {error.message}
        </p>
      ) : null}

      {mediaList.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucun fichier ne correspond.</p>
      ) : view === "grille" ? (
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
              <RecentWorksToggle media={media} className="mt-2" />
              <form action={deleteMedia.bind(null, media.id, media.path)} className="mt-2">
                <SubmitButton pendingText="Suppression…" className="text-xs text-red-600 hover:underline">
                  Supprimer
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-100">
          {mediaList.map((media) => (
            <li key={media.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex h-12 w-12 flex-none items-center justify-center bg-zinc-50">
                {media.kind === "image" || media.kind === "gif" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={media.url}
                    alt={media.filename}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                    {media.kind}
                  </span>
                )}
              </div>
              <div className="min-w-[160px] flex-1">
                <p className="truncate text-sm" title={media.filename}>
                  {media.filename}
                </p>
                <p className="truncate text-xs text-zinc-400">
                  {media.products ? media.products.title : "Non utilisée"}
                </p>
              </div>
              <p className="text-xs text-zinc-500">
                {dateFormatter.format(new Date(media.created_at))}
              </p>
              <RecentWorksToggle media={media} />
              <form action={deleteMedia.bind(null, media.id, media.path)}>
                <SubmitButton pendingText="Suppression…" className="text-xs text-red-600 hover:underline">
                  Supprimer
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentWorksToggle({
  media,
  className,
}: {
  media: MediaRow;
  className?: string;
}) {
  return (
    <label
      className={
        media.product_id
          ? `flex items-center gap-2 text-xs ${className ?? ""}`
          : `flex items-center gap-2 text-xs text-zinc-400 ${className ?? ""}`
      }
      title={
        media.product_id
          ? undefined
          : "Associe ce fichier à un produit pour l'afficher dans Œuvres récentes"
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
          <SubmitButton
            pendingText="…"
            className={
              media.products.show_in_recent_works
                ? "rounded bg-[#eef4ec] px-2 py-1 text-xs font-medium text-[#3a6b3a]"
                : "rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-500"
            }
          >
            {media.products.show_in_recent_works
              ? "Dans Œuvres récentes"
              : "Ajouter à Œuvres récentes"}
          </SubmitButton>
        </form>
      ) : (
        <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-400">
          Œuvres récentes
        </span>
      )}
    </label>
  );
}
