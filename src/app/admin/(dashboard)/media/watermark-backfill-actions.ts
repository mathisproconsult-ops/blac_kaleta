"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type WatermarkImageRef = { kind: "product" | "media"; id: number };

// Recense toutes les photos déjà passées par le filigrane (originaux
// conservés pour les produits, copie publique pour les entrées Photo
// d'Œuvres récentes) — utilisé pour régénérer le filigrane de tout le
// catalogue après la correction de la police manquante (voir
// buildWatermarkSvg dans lib/image-protection.ts). Pas de distinction
// "déjà correct"/"cassé" possible sans inspection visuelle : on régénère
// tout, opération sans risque (chaque régénération produit un nouveau
// fichier, jamais une réécriture en place).
export async function listImagesNeedingWatermarkRefresh(): Promise<{
  images: WatermarkImageRef[];
  error: string | null;
}> {
  const supabase = await createClient();

  const { data: productRows, error: productError } = await supabase
    .from("product_images")
    .select("id, products(source)")
    .not("original_path", "is", null)
    .order("id", { ascending: true });

  if (productError) {
    console.error("listImagesNeedingWatermarkRefresh products", productError);
    return { images: [], error: productError.message };
  }

  const productImages = ((productRows ?? []) as unknown as {
    id: number;
    products: { source: string } | null;
  }[])
    .filter((row) => row.products?.source !== "printify")
    .map((row): WatermarkImageRef => ({ kind: "product", id: row.id }));

  const { data: mediaRows, error: mediaError } = await supabase
    .from("recent_work_media")
    .select("id")
    .eq("kind", "photo")
    .not("image_path", "is", null)
    .order("id", { ascending: true });

  if (mediaError) {
    console.error("listImagesNeedingWatermarkRefresh media", mediaError);
    return { images: productImages, error: null };
  }

  const mediaImages = ((mediaRows ?? []) as { id: number }[]).map(
    (row): WatermarkImageRef => ({ kind: "media", id: row.id }),
  );

  return { images: [...productImages, ...mediaImages], error: null };
}

export type WatermarkResult = {
  status: "done" | "skipped" | "error";
  message?: string;
  // Contexte utile pour retrouver l'image en échec depuis le dashboard —
  // l'id technique de la ligne product_images/recent_work_media ne dit
  // rien à l'admin, le produit/titre si.
  productId?: number;
  title?: string;
};

// Une erreur Supabase Storage (StorageError) peut avoir un message vide
// ou absent selon le type d'échec ; ce filet garantit qu'un message
// toujours lisible remonte jusqu'au dashboard plutôt qu'un champ vide.
function describeError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string" && err.message) {
    return err.message;
  }
  if (typeof err === "string" && err) return err;
  return fallback;
}

async function regenerateProductWatermark(
  supabase: SupabaseClient,
  id: number,
): Promise<WatermarkResult> {
  const { data: image, error } = await supabase
    .from("product_images")
    .select("product_id, original_path, products(title)")
    .eq("id", id)
    .maybeSingle();

  if (error || !image) return { status: "error", message: "Photo introuvable." };
  const context = {
    productId: image.product_id,
    title: (image as { products?: { title?: string } | null }).products?.title,
  };
  if (!image.original_path) {
    return { status: "skipped", message: "Pas d'original conservé.", ...context };
  }
  if (image.original_path.toLowerCase().endsWith(".gif")) {
    return { status: "skipped", message: "GIF animé, non retraité.", ...context };
  }

  const { data: downloaded, error: downloadError } = await supabase.storage
    .from("artwork-originals")
    .download(image.original_path);
  if (downloadError || !downloaded) {
    return {
      status: "error",
      message: describeError(downloadError, "Téléchargement de l'original impossible."),
      ...context,
    };
  }
  const sourceBuffer = Buffer.from(await downloaded.arrayBuffer());

  let protectedImage, thumbnailImage;
  try {
    const { protectArtworkImage, THUMBNAIL_MAX_DIMENSION } = await import("@/lib/image-protection");
    [protectedImage, thumbnailImage] = await Promise.all([
      protectArtworkImage(sourceBuffer),
      protectArtworkImage(sourceBuffer, THUMBNAIL_MAX_DIMENSION),
    ]);
  } catch (err) {
    return { status: "error", message: describeError(err, "Échec du traitement de l'image."), ...context };
  }

  const destPath = `${image.product_id}/${id}-${Date.now()}.${protectedImage.extension}`;
  const thumbDestPath = `${image.product_id}/${id}-${Date.now()}-thumb.${thumbnailImage.extension}`;

  const [publicUpload, thumbnailUpload] = await Promise.all([
    supabase.storage.from("products").upload(destPath, protectedImage.buffer, {
      contentType: protectedImage.contentType,
      cacheControl: "31536000",
    }),
    supabase.storage.from("products").upload(thumbDestPath, thumbnailImage.buffer, {
      contentType: thumbnailImage.contentType,
      cacheControl: "31536000",
    }),
  ]);
  if (publicUpload.error) {
    return {
      status: "error",
      message: describeError(publicUpload.error, "Échec de l'envoi de l'image."),
      ...context,
    };
  }

  const { data: publicUrlData } = supabase.storage.from("products").getPublicUrl(destPath);
  const updates: Record<string, unknown> = {
    path: destPath,
    url: publicUrlData.publicUrl,
    width: protectedImage.width,
    height: protectedImage.height,
  };
  if (!thumbnailUpload.error) {
    const { data: thumbUrlData } = supabase.storage.from("products").getPublicUrl(thumbDestPath);
    updates.thumbnail_path = thumbDestPath;
    updates.thumbnail_url = thumbUrlData.publicUrl;
  }

  const { error: updateError } = await supabase.from("product_images").update(updates).eq("id", id);
  if (updateError) {
    return { status: "error", message: describeError(updateError, "Échec de mise à jour."), ...context };
  }

  return { status: "done", ...context };
}

async function regenerateMediaWatermark(
  supabase: SupabaseClient,
  id: number,
): Promise<WatermarkResult> {
  const { data: media, error } = await supabase
    .from("recent_work_media")
    .select("recent_work_category_id, image_path, title")
    .eq("id", id)
    .maybeSingle();

  if (error || !media) return { status: "error", message: "Entrée introuvable." };
  const context = { title: media.title };
  if (!media.image_path) return { status: "skipped", message: "Pas d'image.", ...context };
  if (media.image_path.toLowerCase().endsWith(".gif")) {
    return { status: "skipped", message: "GIF animé, non retraité.", ...context };
  }

  // Les entrées Photo d'Œuvres récentes ne conservent pas de référence
  // explicite à leur original (contrairement aux produits), mais
  // protectAndStoreArtworkImage uploade toujours l'original et la copie
  // publique au même chemin relatif, juste dans des buckets différents —
  // on tente donc "artwork-originals" au même chemin, et on retombe sur la
  // copie publique actuelle si l'original n'y est pas (plus rare, mais
  // corrige quand même le filigrane cassé).
  let sourceBuffer: Buffer | null = null;
  const { data: originalDownload } = await supabase.storage
    .from("artwork-originals")
    .download(media.image_path);
  if (originalDownload) {
    sourceBuffer = Buffer.from(await originalDownload.arrayBuffer());
  } else {
    const { data: publicDownload, error: publicDownloadError } = await supabase.storage
      .from("products")
      .download(media.image_path);
    if (publicDownloadError || !publicDownload) {
      return {
        status: "error",
        message: describeError(publicDownloadError, "Téléchargement de l'image impossible."),
        ...context,
      };
    }
    sourceBuffer = Buffer.from(await publicDownload.arrayBuffer());
  }

  let protectedImage, thumbnailImage;
  try {
    const { protectArtworkImage, THUMBNAIL_MAX_DIMENSION } = await import("@/lib/image-protection");
    [protectedImage, thumbnailImage] = await Promise.all([
      protectArtworkImage(sourceBuffer),
      protectArtworkImage(sourceBuffer, THUMBNAIL_MAX_DIMENSION),
    ]);
  } catch (err) {
    return { status: "error", message: describeError(err, "Échec du traitement de l'image."), ...context };
  }

  const destFolder = `recent-works/${media.recent_work_category_id}`;
  const destPath = `${destFolder}/${id}-${Date.now()}.${protectedImage.extension}`;
  const thumbDestPath = `${destFolder}/${id}-${Date.now()}-thumb.${thumbnailImage.extension}`;

  const [publicUpload, thumbnailUpload] = await Promise.all([
    supabase.storage.from("products").upload(destPath, protectedImage.buffer, {
      contentType: protectedImage.contentType,
      cacheControl: "31536000",
    }),
    supabase.storage.from("products").upload(thumbDestPath, thumbnailImage.buffer, {
      contentType: thumbnailImage.contentType,
      cacheControl: "31536000",
    }),
  ]);
  if (publicUpload.error) {
    return {
      status: "error",
      message: describeError(publicUpload.error, "Échec de l'envoi de l'image."),
      ...context,
    };
  }

  const { data: publicUrlData } = supabase.storage.from("products").getPublicUrl(destPath);
  const updates: Record<string, unknown> = {
    image_path: destPath,
    image_url: publicUrlData.publicUrl,
  };
  if (!thumbnailUpload.error) {
    const { data: thumbUrlData } = supabase.storage.from("products").getPublicUrl(thumbDestPath);
    // Best-effort : la colonne peut ne pas encore exister (migration 0038).
    updates.thumbnail_path = thumbDestPath;
    updates.thumbnail_url = thumbUrlData.publicUrl;
  }

  const { error: updateError } = await supabase
    .from("recent_work_media")
    .update(updates)
    .eq("id", id);
  if (updateError) {
    return { status: "error", message: describeError(updateError, "Échec de mise à jour."), ...context };
  }

  return { status: "done", ...context };
}

// Traite UNE image — appelé en boucle depuis le navigateur (même principe
// que les autres outils de retraitement en masse), pour donner une
// progression réelle et rester loin de toute limite de temps d'exécution
// serveur.
export async function regenerateWatermarkForImage(ref: WatermarkImageRef): Promise<WatermarkResult> {
  const supabase = await createClient();
  try {
    return ref.kind === "product"
      ? await regenerateProductWatermark(supabase, ref.id)
      : await regenerateMediaWatermark(supabase, ref.id);
  } catch (err) {
    console.error("regenerateWatermarkForImage", ref, err);
    return { status: "error", message: describeError(err, "Erreur inconnue.") };
  }
}

export async function revalidateAfterWatermarkRefresh() {
  revalidatePath("/admin/products");
  revalidatePath("/admin/oeuvres-recentes");
  revalidatePath("/");
  revalidatePath("/boutique");
  revalidatePath("/oeuvres-recentes");
}
