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
  product_images: { id: number; url: string; position: number }[];
  age_restricted: boolean;
  image_blurred_url: string | null;
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
  age_restricted: boolean;
  image_blurred_url: string | null;
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
  // Colonnes issues des migrations 0031/0034/0035 (confirmées appliquées
  // depuis longtemps) : regroupées directement dans les requêtes
  // principales plutôt qu'en requêtes séparées, pour limiter le nombre
  // d'allers-retours à la base sur cette page.
  const [{ data: category }, { data: products }, { data: media }] = await Promise.all([
    supabase
      .from("recent_work_categories")
      .select("id, name, age_restricted")
      .eq("id", categoryId)
      .maybeSingle(),
    supabase
      .from("products")
      .select(
        "id, title, year, techniques(name), product_images(id, url, position), age_restricted, image_blurred_url",
      )
      .eq("recent_work_category_id", categoryId)
      .eq("show_in_recent_works", true)
      .eq("is_visible", true)
      .is("deleted_at", null)
      .returns<ProductWork[]>(),
    supabase
      .from("recent_work_media")
      .select(
        "id, title, year, techniques(name), kind, image_url, video_url, video_provider, video_external_url, age_restricted, image_blurred_url",
      )
      .eq("recent_work_category_id", categoryId)
      .order("position", { ascending: true })
      .returns<MediaWork[]>(),
  ]);

  if (!category) notFound();

  const categoryAgeRestricted = (category as { age_restricted?: boolean }).age_restricted ?? false;

  const cookieStore = await cookies();
  const verified = cookieStore.get(`av_cat_${categoryId}`)?.value === "1";
  const locked = categoryAgeRestricted && !verified;

  // Requêtes séparées et best-effort : ces colonnes peuvent ne pas encore
  // exister (migration 0038, pas encore appliquée) — sans elles, la grille
  // retombe simplement sur l'image pleine résolution comme avant.
  const mediaIds = (media ?? []).map((item) => item.id);
  const mediaThumbnailUrlById = new Map<number, string | null>();
  if (mediaIds.length > 0) {
    const { data: rows } = await supabase
      .from("recent_work_media")
      .select("id, thumbnail_url")
      .in("id", mediaIds);
    if (rows) {
      for (const row of rows as { id: number; thumbnail_url: string | null }[]) {
        mediaThumbnailUrlById.set(row.id, row.thumbnail_url);
      }
    }
  }

  const productImageThumbnailById = new Map<number, string | null>();
  const productImageIds = (products ?? []).flatMap((product) =>
    product.product_images.map((image) => image.id),
  );
  if (productImageIds.length > 0) {
    const { data: rows } = await supabase
      .from("product_images")
      .select("id, thumbnail_url")
      .in("id", productImageIds);
    if (rows) {
      for (const row of rows as { id: number; thumbnail_url: string | null }[]) {
        productImageThumbnailById.set(row.id, row.thumbnail_url);
      }
    }
  }

  type UnifiedWork = {
    id: string;
    title: string;
    year: number | null;
    technique: string | null;
    imageUrl: string | null;
    thumbnailUrl: string | null;
    kind: "oeuvre" | "photo" | "video";
    videoUrl?: string | null;
    videoEmbedUrl?: string | null;
    videoEmbedPortrait?: boolean;
    locked?: boolean;
    ageRestricted?: boolean;
  };

  const productWorks: UnifiedWork[] = (products ?? []).map((product) => {
    const itemAgeRestricted = product.age_restricted ?? false;
    // Cache réel dès que la catégorie est verrouillée OU que l'œuvre est
    // elle-même marquée +18 : jamais l'URL réelle envoyée dans ces deux cas.
    const hide = locked || itemAgeRestricted;
    const firstImage = [...product.product_images].sort((a, b) => a.position - b.position)[0];
    const fullUrl = hide ? product.image_blurred_url ?? null : firstImage?.url ?? null;
    const thumbnailUrl = hide
      ? fullUrl
      : (firstImage ? productImageThumbnailById.get(firstImage.id) : null) ?? fullUrl;
    return {
      id: `product-${product.id}`,
      title: product.title,
      year: product.year,
      technique: product.techniques?.name ?? null,
      imageUrl: fullUrl,
      thumbnailUrl,
      kind: "oeuvre",
      locked,
      ageRestricted: itemAgeRestricted,
    };
  });

  const mediaWorks: UnifiedWork[] = (media ?? []).map((item) => {
    const itemAgeRestricted = item.age_restricted ?? false;
    const hide = locked || itemAgeRestricted;
    let videoEmbedUrl: string | null = null;
    if (!hide && item.kind === "video" && item.video_provider && item.video_external_url) {
      const ref = parseVideoUrl(item.video_external_url);
      videoEmbedUrl = ref ? embedUrl(ref) : null;
    }
    const fullUrl = hide ? item.image_blurred_url ?? null : item.image_url;
    const thumbnailUrl = hide ? fullUrl : mediaThumbnailUrlById.get(item.id) ?? fullUrl;
    return {
      id: `media-${item.id}`,
      title: item.title,
      year: item.year,
      technique: item.techniques?.name ?? null,
      imageUrl: fullUrl,
      thumbnailUrl,
      kind: item.kind,
      videoUrl: hide ? null : item.video_url,
      videoEmbedUrl,
      videoEmbedPortrait: item.video_provider === "instagram" || item.video_provider === "tiktok",
      locked,
      ageRestricted: itemAgeRestricted,
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
        {categoryAgeRestricted ? (
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

  if (!categoryAgeRestricted) return content;

  return (
    <AgeGate categoryId={categoryId} locked={locked}>
      {content}
    </AgeGate>
  );
}
