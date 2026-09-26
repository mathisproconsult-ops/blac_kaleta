"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function parseBucketAndPath(url: string): { bucket: string; path: string } | null {
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

// Une image "de décor" déjà passée par optimizeAndStoreDecorImage se
// termine toujours en .webp — une URL qui ne l'est pas (et n'est pas un
// GIF, volontairement non retraité) signale une image encore telle
// qu'envoyée par l'admin (parfois plusieurs Mo depuis un téléphone) : soit
// uploadée avant la mise en place de cette optimisation, soit choisie
// depuis la Médiathèque (dont les uploads bruts ne sont pas compressés).
function looksUnoptimized(url: string): boolean {
  const lower = url.toLowerCase().split("?")[0];
  return !lower.endsWith(".webp") && !lower.endsWith(".gif");
}

export type DecorImageRef = {
  kind: "logo" | "category" | "recent-work-category" | "popup" | "page-block";
  id: number | null;
  label: string;
};

// Recense le logo, les couvertures de catégories (Boutique et Œuvres
// récentes), les images de popups et les images de blocs de page qui
// n'ont pas encore l'air d'être passées par le pipeline d'optimisation.
export async function listDecorImagesNeedingOptimization(): Promise<{
  images: DecorImageRef[];
  error: string | null;
}> {
  const supabase = await createClient();
  const images: DecorImageRef[] = [];

  const { data: settings } = await supabase
    .from("settings")
    .select("header_logo_url")
    .eq("id", true)
    .maybeSingle();
  if (settings?.header_logo_url && looksUnoptimized(settings.header_logo_url)) {
    images.push({ kind: "logo", id: null, label: "Logo du site" });
  }

  const { data: categories } = await supabase.from("categories").select("id, name, cover_image_url");
  for (const category of categories ?? []) {
    if (category.cover_image_url && looksUnoptimized(category.cover_image_url)) {
      images.push({ kind: "category", id: category.id, label: `Catégorie « ${category.name} »` });
    }
  }

  // Requête best-effort : la colonne age_restricted n'est pas sélectionnée
  // ici (sans rapport), mais cover_image_url peut ne pas encore exister sur
  // les tout premiers déploiements — un échec ne doit pas casser le reste.
  const { data: recentCategories } = await supabase
    .from("recent_work_categories")
    .select("id, name, cover_image_url");
  for (const category of recentCategories ?? []) {
    if (category.cover_image_url && looksUnoptimized(category.cover_image_url)) {
      images.push({
        kind: "recent-work-category",
        id: category.id,
        label: `Œuvres récentes « ${category.name} »`,
      });
    }
  }

  const { data: popups } = await supabase.from("popups").select("id, title, image_url");
  for (const popup of popups ?? []) {
    if (popup.image_url && looksUnoptimized(popup.image_url)) {
      images.push({ kind: "popup", id: popup.id, label: `Popup « ${popup.title} »` });
    }
  }

  const { data: blocks } = await supabase
    .from("page_blocks")
    .select("id, content")
    .eq("type", "image");
  for (const block of blocks ?? []) {
    const url = (block.content as { url?: string } | null)?.url;
    if (url && looksUnoptimized(url)) {
      images.push({ kind: "page-block", id: block.id, label: `Bloc image #${block.id}` });
    }
  }

  return { images, error: null };
}

export type DecorBackfillResult = { status: "done" | "skipped" | "error"; message?: string };

// Télécharge l'image actuelle (quel que soit son bucket d'origine — "pages"
// pour un upload direct, "media" si choisie depuis la Médiathèque),
// l'optimise, puis l'uploade comme une NOUVELLE copie (jamais en écrasant
// l'original, qui peut être un fichier partagé de la Médiathèque encore
// utilisé ailleurs).
async function reoptimize(
  supabase: SupabaseClient,
  currentUrl: string,
  destFolder: string,
): Promise<{ path: string; url: string } | null> {
  const located = parseBucketAndPath(currentUrl);
  if (!located) return null;
  if (located.path.toLowerCase().endsWith(".gif")) return null;

  const { data: downloaded, error } = await supabase.storage.from(located.bucket).download(located.path);
  if (error || !downloaded) return null;

  const buffer = Buffer.from(await downloaded.arrayBuffer());
  const { optimizeDecorImage } = await import("@/lib/image-protection");
  const optimized = await optimizeDecorImage(buffer);

  const path = `${destFolder}/${crypto.randomUUID()}.${optimized.extension}`;
  const { error: uploadError } = await supabase.storage
    .from("pages")
    .upload(path, optimized.buffer, { contentType: optimized.contentType, cacheControl: "31536000" });
  if (uploadError) return null;

  const { data } = supabase.storage.from("pages").getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export async function backfillOneDecorImage(ref: DecorImageRef): Promise<DecorBackfillResult> {
  const supabase = await createClient();

  switch (ref.kind) {
    case "logo": {
      const { data: settings } = await supabase
        .from("settings")
        .select("header_logo_url")
        .eq("id", true)
        .maybeSingle();
      if (!settings?.header_logo_url) return { status: "skipped", message: "Aucun logo." };
      const optimized = await reoptimize(supabase, settings.header_logo_url, "branding");
      if (!optimized) return { status: "error", message: "Échec de l'optimisation." };
      await supabase
        .from("settings")
        .update({ header_logo_url: optimized.url, header_logo_path: optimized.path })
        .eq("id", true);
      return { status: "done" };
    }
    case "category": {
      const { data: category } = await supabase
        .from("categories")
        .select("cover_image_url")
        .eq("id", ref.id as number)
        .maybeSingle();
      if (!category?.cover_image_url) return { status: "skipped", message: "Aucune image." };
      const optimized = await reoptimize(supabase, category.cover_image_url, `categories/${ref.id}`);
      if (!optimized) return { status: "error", message: "Échec de l'optimisation." };
      await supabase
        .from("categories")
        .update({ cover_image_url: optimized.url, cover_image_path: optimized.path })
        .eq("id", ref.id as number);
      return { status: "done" };
    }
    case "recent-work-category": {
      const { data: category } = await supabase
        .from("recent_work_categories")
        .select("cover_image_url")
        .eq("id", ref.id as number)
        .maybeSingle();
      if (!category?.cover_image_url) return { status: "skipped", message: "Aucune image." };
      const optimized = await reoptimize(
        supabase,
        category.cover_image_url,
        `recent-work-categories/${ref.id}`,
      );
      if (!optimized) return { status: "error", message: "Échec de l'optimisation." };
      await supabase
        .from("recent_work_categories")
        .update({ cover_image_url: optimized.url, cover_image_path: optimized.path })
        .eq("id", ref.id as number);
      return { status: "done" };
    }
    case "popup": {
      const { data: popup } = await supabase
        .from("popups")
        .select("image_url")
        .eq("id", ref.id as number)
        .maybeSingle();
      if (!popup?.image_url) return { status: "skipped", message: "Aucune image." };
      const optimized = await reoptimize(supabase, popup.image_url, `popups/${ref.id}`);
      if (!optimized) return { status: "error", message: "Échec de l'optimisation." };
      await supabase
        .from("popups")
        .update({ image_url: optimized.url, image_path: optimized.path })
        .eq("id", ref.id as number);
      return { status: "done" };
    }
    case "page-block": {
      const { data: block } = await supabase
        .from("page_blocks")
        .select("content")
        .eq("id", ref.id as number)
        .maybeSingle();
      const content = block?.content as { url?: string; alt?: string } | null;
      if (!content?.url) return { status: "skipped", message: "Aucune image." };
      const optimized = await reoptimize(supabase, content.url, "backfill");
      if (!optimized) return { status: "error", message: "Échec de l'optimisation." };
      await supabase
        .from("page_blocks")
        .update({ content: { url: optimized.url, path: optimized.path, alt: content.alt ?? "" } })
        .eq("id", ref.id as number);
      return { status: "done" };
    }
    default:
      return { status: "error", message: "Type inconnu." };
  }
}

export async function revalidateAfterDecorBackfill() {
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
}
