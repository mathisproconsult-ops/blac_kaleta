"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { blurStoredImage, createBlurredArtworkPreview } from "@/lib/artwork-storage";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type BlurWorkRef = { kind: "media" | "product"; id: number; categoryId: number };

// Une œuvre doit être floutée si elle est marquée +18 individuellement, OU
// si sa catégorie "Œuvres récentes" l'est — mais jusqu'ici, seul le
// changement de la case +18 d'une œuvre déclenchait la génération de
// l'aperçu flouté. Marquer une catégorie entière comme +18 (ou y déplacer
// une œuvre déjà existante) ne régénérait rien pour le contenu déjà en
// place, d'où des œuvres masquées mais sans image de remplacement (motif de
// hachures au lieu du flou). Ce fichier retrouve toutes les œuvres dans ce
// cas et régénère leur aperçu flouté à partir de l'image déjà protégée —
// jamais depuis l'original.
export async function listWorksNeedingBlur(): Promise<{
  works: BlurWorkRef[];
  error: string | null;
}> {
  const supabase = await createClient();

  const { data: categories, error: categoriesError } = await supabase
    .from("recent_work_categories")
    .select("id, age_restricted");

  if (categoriesError) {
    console.error("listWorksNeedingBlur categories", categoriesError);
    return { works: [], error: categoriesError.message };
  }

  const restrictedCategoryIds = new Set(
    (categories ?? [])
      .filter((category) => (category as { age_restricted?: boolean }).age_restricted)
      .map((category) => category.id),
  );

  const { data: mediaRows, error: mediaError } = await supabase
    .from("recent_work_media")
    .select("id, recent_work_category_id, age_restricted")
    .is("image_blurred_path", null);

  if (mediaError) {
    console.error("listWorksNeedingBlur media", mediaError);
    return { works: [], error: mediaError.message };
  }

  const mediaWorks: BlurWorkRef[] = (
    (mediaRows ?? []) as {
      id: number;
      recent_work_category_id: number;
      age_restricted?: boolean;
    }[]
  )
    .filter((row) => row.age_restricted || restrictedCategoryIds.has(row.recent_work_category_id))
    .map((row) => ({ kind: "media", id: row.id, categoryId: row.recent_work_category_id }));

  const { data: productRows, error: productError } = await supabase
    .from("products")
    .select("id, recent_work_category_id, age_restricted")
    .not("recent_work_category_id", "is", null)
    .is("image_blurred_path", null);

  if (productError) {
    console.error("listWorksNeedingBlur products", productError);
    return { works: mediaWorks, error: null };
  }

  const productWorks: BlurWorkRef[] = (
    (productRows ?? []) as {
      id: number;
      recent_work_category_id: number;
      age_restricted?: boolean;
    }[]
  )
    .filter((row) => row.age_restricted || restrictedCategoryIds.has(row.recent_work_category_id))
    .map((row) => ({ kind: "product", id: row.id, categoryId: row.recent_work_category_id }));

  return { works: [...mediaWorks, ...productWorks], error: null };
}

export type BackfillResult = { status: "done" | "skipped" | "error"; message?: string };

async function backfillMedia(supabase: SupabaseClient, id: number, categoryId: number): Promise<BackfillResult> {
  const { data: row, error } = await supabase
    .from("recent_work_media")
    .select("image_path, image_url, image_blurred_path")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) return { status: "error", message: "Entrée introuvable." };
  if ((row as { image_blurred_path?: string | null }).image_blurred_path) {
    return { status: "skipped", message: "Déjà floutée." };
  }

  let blurred: { path: string; url: string } | null = null;
  if (row.image_path) {
    blurred = await blurStoredImage(supabase, `recent-works/${categoryId}`, "products", row.image_path);
  } else if (row.image_url) {
    try {
      const response = await fetch(row.image_url);
      if (response.ok) {
        const sourceBuffer = Buffer.from(await response.arrayBuffer());
        blurred = await createBlurredArtworkPreview(supabase, `recent-works/${categoryId}`, sourceBuffer);
      }
    } catch (err) {
      console.error("backfillMedia fetch", id, err);
    }
  }

  if (!blurred) return { status: "skipped", message: "Aucune image source disponible." };

  const { error: updateError } = await supabase
    .from("recent_work_media")
    .update({ image_blurred_path: blurred.path, image_blurred_url: blurred.url })
    .eq("id", id);
  if (updateError) return { status: "error", message: updateError.message };

  return { status: "done" };
}

async function backfillProduct(supabase: SupabaseClient, id: number): Promise<BackfillResult> {
  const { data: existing } = await supabase
    .from("products")
    .select("image_blurred_path")
    .eq("id", id)
    .maybeSingle();
  if ((existing as { image_blurred_path?: string | null } | null)?.image_blurred_path) {
    return { status: "skipped", message: "Déjà floutée." };
  }

  const { data: firstImage } = await supabase
    .from("product_images")
    .select("path")
    .eq("product_id", id)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstImage?.path) {
    return { status: "skipped", message: "Aucune image source disponible." };
  }

  const blurred = await blurStoredImage(supabase, String(id), "products", firstImage.path);
  if (!blurred) return { status: "error", message: "Échec de la génération du flou." };

  const { error: updateError } = await supabase
    .from("products")
    .update({ image_blurred_path: blurred.path, image_blurred_url: blurred.url })
    .eq("id", id);
  if (updateError) return { status: "error", message: updateError.message };

  return { status: "done" };
}

// Traite UNE œuvre — appelé en boucle depuis le navigateur (même principe
// que le retraitement des vignettes en Médiathèque), pour donner une
// progression réelle et rester loin de toute limite de temps d'exécution
// serveur.
export async function backfillOneWork(work: BlurWorkRef): Promise<BackfillResult> {
  const supabase = await createClient();
  return work.kind === "media"
    ? backfillMedia(supabase, work.id, work.categoryId)
    : backfillProduct(supabase, work.id);
}

export async function revalidateAfterBlurBackfill() {
  revalidatePath("/admin/oeuvres-recentes");
  revalidatePath("/admin/products");
  revalidatePath("/oeuvres-recentes");
}
