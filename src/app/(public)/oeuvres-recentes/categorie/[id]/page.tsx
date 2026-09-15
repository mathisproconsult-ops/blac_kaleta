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

  const categoryAgeRestricted =
    (ageRestrictedRow as { age_restricted: boolean } | null)?.age_restricted ?? false;

  const cookieStore = await cookies();
  const verified = cookieStore.get(`av_cat_${categoryId}`)?.value === "1";
  const locked = categoryAgeRestricted && !verified;

  // Requêtes séparées et best-effort : ces colonnes peuvent ne pas encore
  // exister si la migration 0035 n'a pas été appliquée — dans ce cas,
  // aucune œuvre individuelle n'est traitée comme sensible.
  const productIds = (products ?? []).map((product) => product.id);
  const productAgeRestrictedById = new Map<number, boolean>();
  const productBlurredUrlById = new Map<number, string | null>();
  if (productIds.length > 0) {
    const { data: rows } = await supabase
      .from("products")
      .select("id, age_restricted, image_blurred_url")
      .in("id", productIds);
    if (rows) {
      for (const row of rows as { id: number; age_restricted: boolean; image_blurred_url: string | null }[]) {
        productAgeRestrictedById.set(row.id, row.age_restricted);
        productBlurredUrlById.set(row.id, row.image_blurred_url);
      }
    }
  }

  const mediaIds = (media ?? []).map((item) => item.id);
  const mediaAgeRestrictedById = new Map<number, boolean>();
  const mediaBlurredUrlById = new Map<number, string | null>();
  if (mediaIds.length > 0) {
    const { data: rows } = await supabase
      .from("recent_work_media")
      .select("id, age_restricted, image_blurred_url")
      .in("id", mediaIds);
    if (rows) {
      for (const row of rows as { id: number; age_restricted: boolean; image_blurred_url: string | null }[]) {
        mediaAgeRestrictedById.set(row.id, row.age_restricted);
        mediaBlurredUrlById.set(row.id, row.image_blurred_url);
      }
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
    ageRestricted?: boolean;
  };

  const productWorks: UnifiedWork[] = (products ?? []).map((product) => {
    const itemAgeRestricted = productAgeRestrictedById.get(product.id) ?? false;
    // Cache réel dès que la catégorie est verrouillée OU que l'œuvre est
    // elle-même marquée +18 : jamais l'URL réelle envoyée dans ces deux cas.
    const hide = locked || itemAgeRestricted;
    return {
      id: `product-${product.id}`,
      title: product.title,
      year: product.year,
      technique: product.techniques?.name ?? null,
      imageUrl: hide
        ? productBlurredUrlById.get(product.id) ?? null
        : [...product.product_images].sort((a, b) => a.position - b.position)[0]?.url ?? null,
      kind: "oeuvre",
      locked,
      ageRestricted: itemAgeRestricted,
    };
  });

  const mediaWorks: UnifiedWork[] = (media ?? []).map((item) => {
    const itemAgeRestricted = mediaAgeRestrictedById.get(item.id) ?? false;
    const hide = locked || itemAgeRestricted;
    let videoEmbedUrl: string | null = null;
    if (!hide && item.kind === "video" && item.video_provider && item.video_external_url) {
      const ref = parseVideoUrl(item.video_external_url);
      videoEmbedUrl = ref ? embedUrl(ref) : null;
    }
    return {
      id: `media-${item.id}`,
      title: item.title,
      year: item.year,
      technique: item.techniques?.name ?? null,
      imageUrl: hide ? mediaBlurredUrlById.get(item.id) ?? null : item.image_url,
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
