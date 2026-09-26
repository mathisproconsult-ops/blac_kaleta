import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import type { VideoProvider } from "@/lib/video-embed";
import { AddRecentWorkForm } from "./add-recent-work-form";
import {
  deleteRecentWorkMedia,
  moveRecentWorkMedia,
  toggleRecentWorkMediaAgeRestricted,
} from "./actions";
import { forceRegenerateMediaBlur } from "../backfill-blur-actions";

type MediaRow = {
  id: number;
  title: string;
  year: number | null;
  kind: "photo" | "video";
  image_url: string | null;
  video_url: string | null;
  video_provider: VideoProvider | null;
  video_external_url: string | null;
  position: number;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: category } = await supabase
    .from("recent_work_categories")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  return { title: category ? `${category.name} — Œuvres récentes — Admin` : "Admin Blac_Kaleta" };
}

export default async function RecentWorkCategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId)) notFound();

  const supabase = await createClient();
  const [{ data: category }, { data: media }, { data: techniques }, { data: ageRestrictedRows }] =
    await Promise.all([
      supabase.from("recent_work_categories").select("id, name").eq("id", categoryId).maybeSingle(),
      supabase
        .from("recent_work_media")
        .select(
          "id, title, year, kind, image_url, video_url, video_provider, video_external_url, position",
        )
        .eq("recent_work_category_id", categoryId)
        .order("position", { ascending: true })
        .returns<MediaRow[]>(),
      supabase.from("techniques").select("id, name").order("position", { ascending: true }),
      // Requête séparée et best-effort : la colonne peut ne pas encore
      // exister si la migration 0035 n'a pas été appliquée.
      supabase
        .from("recent_work_media")
        .select("id, age_restricted")
        .eq("recent_work_category_id", categoryId),
    ]);

  if (!category) notFound();
  const items = media ?? [];
  const ageRestrictedById = new Map(
    ((ageRestrictedRows ?? []) as { id: number; age_restricted: boolean }[]).map((row) => [
      row.id,
      row.age_restricted,
    ]),
  );

  return (
    <div>
      <Link href="/admin/oeuvres-recentes" className="text-sm text-zinc-500 hover:underline">
        ← Œuvres récentes — Catégories
      </Link>
      <h1 className="mt-2 text-2xl font-semibold uppercase tracking-wide">{category.name}</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Photos et vidéos affichées dans cette catégorie sur la page publique.
      </p>

      <div className="mt-6">
        <AddRecentWorkForm categoryId={categoryId} techniques={techniques ?? []} />
      </div>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Rien dans cette catégorie pour l&apos;instant.</p>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-100 dark:border-zinc-800">
          {items.map((item, index) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex flex-col">
                <SubmitButton
                  formAction={moveRecentWorkMedia.bind(null, item.id, categoryId, "up")}
                  disabled={index === 0}
                  aria-label="Monter"
                  className="text-xs text-zinc-500 hover:text-black disabled:opacity-20 dark:hover:text-zinc-100"
                >
                  ▲
                </SubmitButton>
                <SubmitButton
                  formAction={moveRecentWorkMedia.bind(null, item.id, categoryId, "down")}
                  disabled={index === items.length - 1}
                  aria-label="Descendre"
                  className="text-xs text-zinc-500 hover:text-black disabled:opacity-20 dark:hover:text-zinc-100"
                >
                  ▼
                </SubmitButton>
              </div>

              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_url} alt={item.title} className="h-14 w-14 flex-none object-cover" />
              ) : (
                <div className="h-14 w-14 flex-none bg-zinc-100 dark:bg-zinc-800" />
              )}

              <div className="min-w-[160px] flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {item.title}
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {item.kind === "video" ? "Vidéo" : "Photo"}
                  </span>
                  {ageRestrictedById.get(item.id) ? (
                    <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white dark:bg-zinc-100 dark:text-zinc-900">
                      +18
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-zinc-500">
                  {[item.year, item.video_provider].filter(Boolean).join(" — ")}
                </p>
              </div>

              <form
                action={toggleRecentWorkMediaAgeRestricted.bind(null, item.id, categoryId)}
                className="flex items-center"
              >
                <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <input
                    type="checkbox"
                    name="age_restricted"
                    defaultChecked={ageRestrictedById.get(item.id) ?? false}
                    onChange={(event) => event.currentTarget.form?.requestSubmit()}
                  />
                  +18
                </label>
              </form>

              <form action={forceRegenerateMediaBlur.bind(null, item.id, categoryId)}>
                <SubmitButton
                  pendingText="…"
                  className="text-xs text-zinc-500 hover:underline dark:text-zinc-400"
                >
                  Régénérer le floutage
                </SubmitButton>
              </form>

              <form action={deleteRecentWorkMedia.bind(null, item.id, categoryId)}>
                <ConfirmSubmitButton
                  confirmMessage="Es-tu sûr de vouloir supprimer cet élément ? Cette action est irréversible."
                  pendingText="…"
                  className="text-sm text-red-600 hover:underline dark:text-red-400"
                >
                  Supprimer
                </ConfirmSubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
