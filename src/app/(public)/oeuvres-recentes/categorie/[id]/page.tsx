import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseVideoUrl, embedUrl, type VideoProvider } from "@/lib/video-embed";
import { FiltersBar } from "../../filters-bar";
import { LightboxGallery } from "../../lightbox-gallery";
import { AgeGate } from "../../age-gate";

type ProductWork = {
  id: number;
  title: string;
  year: number | null;
  techniques: { name: string } | null;
  product_images: { url: string; position: number }[];
};

type MediaWork = {
  id: number;
  title: string;
  year: number | null;
  techniques: { name: string } | null;
  kind: "photo" | "video";
  image_url: string | null;
  video_url: string | null;
  video_provider: VideoProvider | null;
  video_external_url: string | null;
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
  return {
    title: category
      ? `${category.name} — Œuvres récentes — Blac_Kaleta`
      : "Œuvres récentes — Blac_Kaleta",
  };
}

export default async function RecentWorksCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ annee?: string; technique?: string }>;
}) {
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId)) notFound();
  const { annee, technique } = await searchParams;

  const supabase = await createClient();
  const [{ data: category }, { data: products }, { data: media }, { data: ageRestrictedRow }] =
    await Promise.all([
      supabase.from("recent_work_categories").select("id, name").eq("id", categoryId).maybeSingle(),
      supabase
        .from("products")
        .select("id, title, year, techniques(name), product_images(url, position)")
        .eq("recent_work_category_id", categoryId)
        .eq("show_in_recent_works", true)
        .eq("is_visible", true)
        .is("deleted_at", null)
        .returns<ProductWork[]>(),
      supabase
        .from("recent_work_media")
        .select(
          "id, title, year, techniques(name), kind, image_url, video_url, video_provider, video_external_url",
        )
        .eq("recent_work_category_id", categoryId)
        .order("position", { ascending: true })
        .returns<MediaWork[]>(),
      // Requête séparée et best-effort : la colonne peut ne pas encore
      // exister si la migration 0034 n'a pas été appliquée — dans ce cas,
      // la catégorie n'est simplement jamais traitée comme sensible.
      supabase
        .from("recent_work_categories")
        .select("age_restricted")
        .eq("id", categoryId)
        .maybeSingle(),
    ]);

  if (!category) notFound();

  const ageRestricted =
    (ageRestrictedRow as { age_restricted: boolean } | null)?.age_restricted ?? false;

  const cookieStore = await cookies();
  const verified = cookieStore.get(`av_cat_${categoryId}`)?.value === "1";
  const locked = ageRestricted && !verified;

  // Requête séparée et best-effort : les colonnes image_blurred_* peuvent
  // ne pas encore exister si la migration 0034 n'a pas été appliquée — sans
  // elles, une catégorie +18 pas encore migrée affiche un cadenas générique
  // plutôt que l'image nette (jamais l'inverse).
  const mediaIds = (media ?? []).map((item) => item.id);
  let blurredUrlById = new Map<number, string | null>();
  if (locked && mediaIds.length > 0) {
    const { data: blurredRows } = await supabase
      .from("recent_work_media")
      .select("id, image_blurred_url")
      .in("id", mediaIds);
    if (blurredRows) {
      blurredUrlById = new Map(
        (blurredRows as { id: number; image_blurred_url: string | null }[]).map((row) => [
          row.id,
          row.image_blurred_url,
        ]),
      );
    }
  }

  type UnifiedWork = {
    id: string;
    title: string;
    year: number | null;
    technique: string | null;
    imageUrl: string | null;
    kind: "oeuvre" | "photo" | "video";
    videoUrl?: string | null;
    videoEmbedUrl?: string | null;
    videoEmbedPortrait?: boolean;
    locked?: boolean;
  };

  const productWorks: UnifiedWork[] = (products ?? []).map((product) => ({
    id: `product-${product.id}`,
    title: product.title,
    year: product.year,
    technique: product.techniques?.name ?? null,
    // Pas de variante floutée pour les images produit : tant que l'âge
    // n'est pas vérifié, on ne renvoie jamais l'URL réelle plutôt que de
    // servir une image non protégée.
    imageUrl: locked ? null : [...product.product_images].sort((a, b) => a.position - b.position)[0]?.url ?? null,
    kind: "oeuvre",
    locked,
  }));

  const mediaWorks: UnifiedWork[] = (media ?? []).map((item) => {
    let videoEmbedUrl: string | null = null;
    if (!locked && item.kind === "video" && item.video_provider && item.video_external_url) {
      const ref = parseVideoUrl(item.video_external_url);
      videoEmbedUrl = ref ? embedUrl(ref) : null;
    }
    return {
      id: `media-${item.id}`,
      title: item.title,
      year: item.year,
      technique: item.techniques?.name ?? null,
      imageUrl: locked ? blurredUrlById.get(item.id) ?? null : item.image_url,
      kind: item.kind,
      videoUrl: locked ? null : item.video_url,
      videoEmbedUrl,
      videoEmbedPortrait: item.video_provider === "instagram" || item.video_provider === "tiktok",
      locked,
    };
  });

  let works = [...productWorks, ...mediaWorks].sort(
    (a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity),
  );

  const years = Array.from(
    new Set(works.map((work) => work.year).filter((year): year is number => year !== null)),
  ).sort((a, b) => b - a);
  const techniques = Array.from(
    new Set(works.map((work) => work.technique).filter((name): name is string => Boolean(name))),
  ).sort();

  if (annee) works = works.filter((work) => String(work.year) === annee);
  if (technique) works = works.filter((work) => work.technique === technique);

  const hasFilters = Boolean(annee || technique);
  const basePath = `/oeuvres-recentes/categorie/${categoryId}`;

  const content = (
    <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <Link href="/oeuvres-recentes" className="text-sm text-zinc-500 hover:underline">
        ← Toutes les catégories
      </Link>
      <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold uppercase tracking-wide">
        {category.name}
        {ageRestricted ? (
          <span className="rounded bg-zinc-900 px-2 py-1 align-middle text-xs font-medium uppercase tracking-wide text-white dark:bg-zinc-100 dark:text-zinc-900">
            +18
          </span>
        ) : null}
      </h1>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <FiltersBar years={years} techniques={techniques} current={{ annee, technique }} basePath={basePath} />
        <div className="flex items-center gap-4">
          {hasFilters ? (
            <Link href={basePath} className="text-sm text-zinc-500 underline">
              Reset
            </Link>
          ) : null}
          <p className="text-sm text-zinc-500">
            {works.length} élément{works.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {works.length === 0 ? (
        <p className="mt-12 text-sm text-zinc-500">Aucune œuvre ne correspond à ces filtres.</p>
      ) : (
        <LightboxGallery works={works} />
      )}
    </div>
  );

  if (!ageRestricted) return content;

  return (
    <AgeGate categoryId={categoryId} locked={locked}>
      {content}
    </AgeGate>
  );
}
