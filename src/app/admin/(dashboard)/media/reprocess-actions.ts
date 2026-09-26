"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Une URL publique Supabase Storage a la forme
// .../storage/v1/object/public/{bucket}/{path...} — les anciennes photos
// peuvent être dans "products" (tout premier bucket) ou "media" (bucket
// utilisé depuis) selon leur ancienneté.
function parseBucketAndPath(url: string): { bucket: string; path: string } | null {
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

export type ReprocessImageRef = { id: number; productId: number };

type ProductImageSourceRow = {
  id: number;
  product_id: number;
  products: { source: string } | null;
};

// Liste les photos de produits (hors Printify) pas encore passées par le
// pipeline de protection (original_path pas encore renseigné), celles déjà
// protégées mais sans vignette de grille (thumbnail_path, migration 0038),
// et celles complètes mais sans dimensions enregistrées (width/height,
// migration 0040, nécessaires pour réserver l'espace de l'image côté
// navigateur et éviter un décalage visuel) — utilisé par le bouton du
// dashboard pour connaître le total avant de traiter photo par photo et
// afficher une progression réelle.
export async function listImagesNeedingReprocessing(): Promise<{
  images: ReprocessImageRef[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_images")
    .select("id, product_id, products(source)")
    .is("original_path", null)
    .order("id", { ascending: true });

  if (error) {
    console.error("listImagesNeedingReprocessing", error);
    return { images: [], error: error.message };
  }

  const rows = (data ?? []) as unknown as ProductImageSourceRow[];
  const unprotectedImages = rows
    .filter((row) => row.products?.source !== "printify")
    .map((row) => ({ id: row.id, productId: row.product_id }));

  // Requête séparée et best-effort : la colonne thumbnail_path peut ne pas
  // encore exister (migration 0038) — dans ce cas, seules les photos
  // jamais protégées sont proposées au retraitement.
  const { data: missingThumbRows } = await supabase
    .from("product_images")
    .select("id, product_id, products(source)")
    .is("thumbnail_path", null)
    .not("original_path", "is", null)
    .order("id", { ascending: true });

  const missingThumbImages = ((missingThumbRows ?? []) as unknown as ProductImageSourceRow[])
    .filter((row) => row.products?.source !== "printify")
    .map((row) => ({ id: row.id, productId: row.product_id }));

  // Requête séparée et best-effort : la colonne width peut ne pas encore
  // exister (migration 0040).
  const { data: missingDimensionRows } = await supabase
    .from("product_images")
    .select("id, product_id, products(source)")
    .is("width", null)
    .not("original_path", "is", null)
    .not("thumbnail_path", "is", null)
    .order("id", { ascending: true });

  const missingDimensionImages = (
    (missingDimensionRows ?? []) as unknown as ProductImageSourceRow[]
  )
    .filter((row) => row.products?.source !== "printify")
    .map((row) => ({ id: row.id, productId: row.product_id }));

  const seen = new Set(unprotectedImages.map((image) => image.id));
  const images = [...unprotectedImages];
  for (const image of [...missingThumbImages, ...missingDimensionImages]) {
    if (!seen.has(image.id)) {
      seen.add(image.id);
      images.push(image);
    }
  }

  return { images, error: null };
}

export type ReprocessResult = {
  id: number;
  status: "done" | "skipped" | "error";
  message?: string;
};

// Traite UNE photo — appelé en boucle depuis le navigateur (pas une seule
// action qui traiterait tout le catalogue d'un coup, pour donner une vraie
// progression et rester loin de toute limite de temps d'exécution serveur).
export async function reprocessOneImage(imageId: number): Promise<ReprocessResult> {
  const supabase: SupabaseClient = await createClient();

  const { data: image, error: imageError } = await supabase
    .from("product_images")
    .select("id, product_id, url, original_path")
    .eq("id", imageId)
    .maybeSingle();

  if (imageError || !image) {
    return { id: imageId, status: "error", message: "Photo introuvable." };
  }

  // Requête séparée et best-effort : ces colonnes peuvent ne pas encore
  // exister (migrations 0038 et 0040).
  const { data: extraRow } = await supabase
    .from("product_images")
    .select("thumbnail_path, width")
    .eq("id", imageId)
    .maybeSingle();
  const extra = extraRow as { thumbnail_path?: string | null; width?: number | null } | null;
  const hasThumbnail = Boolean(extra?.thumbnail_path);
  const hasDimensions = extra?.width !== null && extra?.width !== undefined;

  if (image.original_path && hasThumbnail && hasDimensions) {
    return { id: imageId, status: "skipped", message: "Déjà traitée." };
  }

  const located = parseBucketAndPath(image.url);
  if (!located) {
    return { id: imageId, status: "error", message: "URL non reconnue." };
  }
  if (located.path.toLowerCase().endsWith(".gif")) {
    return { id: imageId, status: "skipped", message: "GIF animé, non retraité." };
  }

  try {
    const { data: downloaded, error: downloadError } = await supabase.storage
      .from(located.bucket)
      .download(located.path);
    if (downloadError || !downloaded) {
      throw new Error(downloadError?.message ?? "téléchargement vide");
    }
    const sourceBuffer = Buffer.from(await downloaded.arrayBuffer());

    // Import différé : sharp ne doit être chargé que lors d'un retraitement
    // effectif, jamais au simple affichage de la Médiathèque.
    const { protectArtworkImage, THUMBNAIL_MAX_DIMENSION } = await import("@/lib/image-protection");
    const sharp = (await import("sharp")).default;

    if (!image.original_path) {
      // Photo jamais protégée : le fichier actuel EST l'original — produit
      // la copie protégée pleine résolution ET la vignette de grille.
      const [protectedImage, thumbnailImage] = await Promise.all([
        protectArtworkImage(sourceBuffer),
        protectArtworkImage(sourceBuffer, THUMBNAIL_MAX_DIMENSION),
      ]);
      const destPath = `${image.product_id}/${imageId}-${Date.now()}.${protectedImage.extension}`;
      const thumbDestPath = `${image.product_id}/${imageId}-${Date.now()}-thumb.${thumbnailImage.extension}`;

      const [originalUpload, publicUpload, thumbnailUpload] = await Promise.all([
        supabase.storage
          .from("artwork-originals")
          .upload(destPath, sourceBuffer, {
            contentType: "image/*",
            upsert: true,
            cacheControl: "31536000",
          }),
        supabase.storage.from("products").upload(destPath, protectedImage.buffer, {
          contentType: protectedImage.contentType,
          upsert: true,
          cacheControl: "31536000",
        }),
        supabase.storage.from("products").upload(thumbDestPath, thumbnailImage.buffer, {
          contentType: thumbnailImage.contentType,
          upsert: true,
          cacheControl: "31536000",
        }),
      ]);
      if (originalUpload.error) throw new Error(`original : ${originalUpload.error.message}`);
      if (publicUpload.error) throw new Error(`public : ${publicUpload.error.message}`);

      const { data: publicUrlData } = supabase.storage.from("products").getPublicUrl(destPath);
      const updates: Record<string, unknown> = {
        path: destPath,
        url: publicUrlData.publicUrl,
        original_path: destPath,
      };
      if (!thumbnailUpload.error) {
        const { data: thumbUrlData } = supabase.storage.from("products").getPublicUrl(thumbDestPath);
        updates.thumbnail_path = thumbDestPath;
        updates.thumbnail_url = thumbUrlData.publicUrl;
      }

      // Dimensions de la copie protégée déjà connues (calculées par
      // protectArtworkImage) : pas besoin d'une lecture de métadonnées
      // séparée.
      updates.width = protectedImage.width;
      updates.height = protectedImage.height;

      const { error: updateError } = await supabase
        .from("product_images")
        .update(updates)
        .eq("id", imageId);
      if (updateError) throw new Error(`mise à jour : ${updateError.message}`);

      return { id: imageId, status: "done" };
    }

    if (hasThumbnail && !hasDimensions) {
      // Déjà protégée et déjà vignettée, il ne manque que les dimensions —
      // simple lecture de métadonnées sur la copie déjà en ligne, sans
      // aucun re-traitement ni ré-upload (donc sans dédoubler le filigrane).
      const { width, height } = await sharp(sourceBuffer).metadata();
      if (!width || !height) {
        return { id: imageId, status: "error", message: "Dimensions illisibles." };
      }
      const { error: updateError } = await supabase
        .from("product_images")
        .update({ width, height })
        .eq("id", imageId);
      if (updateError) throw new Error(`mise à jour : ${updateError.message}`);
      return { id: imageId, status: "done" };
    }

    // Déjà protégée, il ne manque que la vignette de grille — génère juste
    // celle-ci à partir de la copie déjà en ligne (pas besoin de l'original).
    const thumbnailImage = await protectArtworkImage(sourceBuffer, THUMBNAIL_MAX_DIMENSION);
    const thumbDestPath = `${image.product_id}/${imageId}-${Date.now()}-thumb.${thumbnailImage.extension}`;
    const { error: thumbnailUploadError } = await supabase.storage
      .from("products")
      .upload(thumbDestPath, thumbnailImage.buffer, {
        contentType: thumbnailImage.contentType,
        upsert: true,
        cacheControl: "31536000",
      });
    if (thumbnailUploadError) throw new Error(`vignette : ${thumbnailUploadError.message}`);

    const { data: thumbUrlData } = supabase.storage.from("products").getPublicUrl(thumbDestPath);
    const updates: Record<string, unknown> = {
      thumbnail_path: thumbDestPath,
      thumbnail_url: thumbUrlData.publicUrl,
    };
    if (!hasDimensions) {
      // sourceBuffer est ici la copie déjà protégée (image.original_path
      // est renseigné) : une simple lecture de métadonnées suffit.
      const { width, height } = await sharp(sourceBuffer).metadata();
      if (width && height) {
        updates.width = width;
        updates.height = height;
      }
    }
    const { error: updateError } = await supabase
      .from("product_images")
      .update(updates)
      .eq("id", imageId);
    if (updateError) throw new Error(`mise à jour : ${updateError.message}`);

    return { id: imageId, status: "done" };
  } catch (err) {
    console.error("reprocessOneImage", imageId, err);
    return {
      id: imageId,
      status: "error",
      message: err instanceof Error ? err.message : "Erreur inconnue.",
    };
  }
}

export async function revalidateAfterReprocessing() {
  revalidatePath("/admin/products");
  revalidatePath("/admin/media");
  revalidatePath("/");
  revalidatePath("/boutique");
  revalidatePath("/oeuvres-recentes");
}
