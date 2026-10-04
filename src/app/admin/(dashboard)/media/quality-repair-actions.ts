"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RepairImageRef = { id: number };

// Même périmètre que le filigrane : tous les produits, hors images
// jamais remplacées par un vrai upload (chemin Printify brut, voir
// watermark-backfill-actions.ts) et hors GIF animés (non retraités).
export async function listQualityRepairCandidates(): Promise<{
  images: RepairImageRef[];
  error: string | null;
}> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("product_images")
    .select("id, path")
    .order("id", { ascending: true });

  if (error) {
    console.error("listQualityRepairCandidates", error);
    return { images: [], error: error.message };
  }

  const images = ((rows ?? []) as { id: number; path: string | null }[])
    .filter((row) => !/^https?:\/\//i.test(row.path ?? ""))
    .filter((row) => !row.path?.toLowerCase().endsWith(".gif"))
    .map((row): RepairImageRef => ({ id: row.id }));

  return { images, error: null };
}

export type CheckStatus =
  // L'original est dans un format qu'on ne produit jamais nous-mêmes
  // (png/jpeg/...) : réparation directe possible depuis cet original.
  // Que les dimensions actuelles correspondent ou non à l'original ne
  // change rien au traitement — repartir de l'original ne coûte rien
  // (jamais modifié) et élimine toute double compression éventuelle,
  // visible (dimensions identiques, comme "Croisement") ou masquée par
  // un redimensionnement normal.
  | "candidate_clean_source"
  // L'original est lui-même au format webp — suspect (notre pipeline ne
  // produit que du webp ; un vrai original uploadé par l'artiste l'est
  // presque jamais) : pourrait être une copie déjà compressée
  // accidentellement prise pour l'original. Le fichier brut véritable
  // reste trouvable via la Médiathèque (table media, liée au produit).
  | "candidate_needs_media_lookup"
  // Comme ci-dessus, mais la Médiathèque ne donne aucune piste fiable
  // (0 ou plusieurs fichiers bruts possibles pour ce produit) : pas de
  // réparation automatique possible sans risquer de se tromper de fichier.
  | "candidate_unrecoverable"
  | "error";

export type CheckResult = {
  imageId: number;
  productId: number | null;
  title: string;
  status: CheckStatus;
  // true si les dimensions actuelles égalent celles de l'original (signe
  // confirmé de double compression, comme "Croisement") — à titre
  // d'information seulement, ne change pas le traitement : false signifie
  // juste "redimensionnée normalement", pas "saine à coup sûr".
  dimensionsMatch: boolean;
  message?: string;
};

async function detectFormat(buffer: Buffer): Promise<string | null> {
  try {
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(buffer).metadata();
    return metadata.format ?? null;
  } catch {
    return null;
  }
}

// Vérifie UNE image, sans rien modifier : télécharge l'original et qualifie
// le niveau de confiance qu'on peut lui accorder comme source de
// régénération. Couvre TOUTES les images (pas seulement celles aux
// dimensions inchangées) : repartir de l'original ne coûte rien puisqu'il
// n'est jamais modifié, donc autant le faire par précaution pour toutes,
// même quand un redimensionnement normal masque un éventuel signe de
// double compression.
export async function checkImageForDoubleCompression(ref: RepairImageRef): Promise<CheckResult> {
  const supabase = await createClient();

  const { data: image, error } = await supabase
    .from("product_images")
    .select("product_id, width, height, original_path, products(title)")
    .eq("id", ref.id)
    .maybeSingle();

  const title = (image as { products?: { title?: string } | null } | null)?.products?.title ?? `Image #${ref.id}`;

  if (error || !image) {
    return { imageId: ref.id, productId: null, title, status: "error", dimensionsMatch: false, message: "Image introuvable." };
  }
  const productId = image.product_id;

  if (!image.original_path || !image.width || !image.height) {
    return {
      imageId: ref.id,
      productId,
      title,
      status: "error",
      dimensionsMatch: false,
      message: "Pas d'original ou de dimensions enregistrées — vérification impossible.",
    };
  }

  const { data: downloaded, error: downloadError } = await supabase.storage
    .from("artwork-originals")
    .download(image.original_path);
  if (!downloaded) {
    return {
      imageId: ref.id,
      productId,
      title,
      status: "error",
      dimensionsMatch: false,
      message: `Original introuvable : ${downloadError?.message ?? "erreur inconnue"}`,
    };
  }

  const buffer = Buffer.from(await downloaded.arrayBuffer());
  const sharp = (await import("sharp")).default;
  const metadata = await sharp(buffer).rotate().metadata();
  const originalWidth = metadata.width ?? 0;
  const originalHeight = metadata.height ?? 0;
  const dimensionsMatch = originalWidth === image.width && originalHeight === image.height;

  const format = await detectFormat(buffer);
  if (format && format !== "webp") {
    return { imageId: ref.id, productId, title, status: "candidate_clean_source", dimensionsMatch };
  }

  // Format suspect (webp) ou indéterminé : cherche le fichier brut via la
  // Médiathèque plutôt que de faire confiance à cet original.
  const { data: mediaRows } = await supabase.from("media").select("id").eq("product_id", productId);
  if (mediaRows && mediaRows.length === 1) {
    return { imageId: ref.id, productId, title, status: "candidate_needs_media_lookup", dimensionsMatch };
  }

  return {
    imageId: ref.id,
    productId,
    title,
    status: "candidate_unrecoverable",
    dimensionsMatch,
    message:
      mediaRows && mediaRows.length > 1
        ? "Plusieurs fichiers bruts possibles dans la Médiathèque — ambigu."
        : "Aucun fichier brut retrouvé dans la Médiathèque.",
  };
}

export type RepairResult = {
  imageId: number;
  title: string;
  status: "done" | "skipped" | "error";
  message?: string;
};

function describeError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string" && err.message) {
    return err.message;
  }
  if (typeof err === "string" && err) return err;
  return fallback;
}

// Répare UNE image déjà qualifiée par checkImageForDoubleCompression — ne
// prend JAMAIS la copie publique actuelle comme source (contrairement à
// l'outil de régénération du filigrane, qui l'acceptait en dernier
// recours) : uniquement l'original (candidate_clean_source) ou le fichier
// brut de la Médiathèque (candidate_needs_media_lookup). Un seul passage
// de compression, qualité 82, comme à l'origine.
export async function repairImage(ref: RepairImageRef, status: CheckStatus): Promise<RepairResult> {
  const supabase = await createClient();

  const { data: image, error } = await supabase
    .from("product_images")
    .select("product_id, original_path, products(title)")
    .eq("id", ref.id)
    .maybeSingle();

  const title = (image as { products?: { title?: string } | null } | null)?.products?.title ?? `Image #${ref.id}`;
  if (error || !image) {
    return { imageId: ref.id, title, status: "error", message: "Image introuvable." };
  }

  let sourceBuffer: Buffer | null = null;
  let sourceError: string | null = null;

  if (status === "candidate_clean_source" && image.original_path) {
    const { data: downloaded, error: downloadError } = await supabase.storage
      .from("artwork-originals")
      .download(image.original_path);
    if (downloaded) {
      sourceBuffer = Buffer.from(await downloaded.arrayBuffer());
    } else {
      sourceError = describeError(downloadError, "Téléchargement de l'original impossible.");
    }
  } else if (status === "candidate_needs_media_lookup") {
    const { data: mediaRows } = await supabase
      .from("media")
      .select("id, path")
      .eq("product_id", image.product_id);
    if (mediaRows && mediaRows.length === 1) {
      const { data: downloaded, error: downloadError } = await supabase.storage
        .from("media")
        .download(mediaRows[0].path);
      if (downloaded) {
        sourceBuffer = Buffer.from(await downloaded.arrayBuffer());
      } else {
        sourceError = describeError(downloadError, "Téléchargement du fichier brut impossible.");
      }
    } else {
      sourceError = "Fichier brut introuvable ou ambigu dans la Médiathèque.";
    }
  } else {
    return { imageId: ref.id, title, status: "skipped", message: "Pas de source fiable identifiée." };
  }

  if (!sourceBuffer) {
    return { imageId: ref.id, title, status: "error", message: sourceError ?? "Source introuvable." };
  }

  let protectedImage, thumbnailImage;
  try {
    const { protectArtworkImage, THUMBNAIL_MAX_DIMENSION } = await import("@/lib/image-protection");
    [protectedImage, thumbnailImage] = await Promise.all([
      protectArtworkImage(sourceBuffer),
      protectArtworkImage(sourceBuffer, THUMBNAIL_MAX_DIMENSION),
    ]);
  } catch (err) {
    return { imageId: ref.id, title, status: "error", message: describeError(err, "Échec du traitement.") };
  }

  const destPath = `${image.product_id}/${ref.id}-${Date.now()}.${protectedImage.extension}`;
  const thumbDestPath = `${image.product_id}/${ref.id}-${Date.now()}-thumb.${thumbnailImage.extension}`;

  const [publicUpload, thumbnailUpload, originalUpload] = await Promise.all([
    supabase.storage.from("products").upload(destPath, protectedImage.buffer, {
      contentType: protectedImage.contentType,
      cacheControl: "31536000",
    }),
    supabase.storage.from("products").upload(thumbDestPath, thumbnailImage.buffer, {
      contentType: thumbnailImage.contentType,
      cacheControl: "31536000",
    }),
    supabase.storage.from("artwork-originals").upload(destPath, sourceBuffer, {
      contentType: "application/octet-stream",
      cacheControl: "31536000",
    }),
  ]);
  if (publicUpload.error) {
    return {
      imageId: ref.id,
      title,
      status: "error",
      message: `Envoi de l'image : ${describeError(publicUpload.error, "échec inconnu.")}`,
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
  if (!originalUpload.error) {
    updates.original_path = destPath;
  }

  const { data: updatedRow, error: updateError } = await supabase
    .from("product_images")
    .update(updates)
    .eq("id", ref.id)
    .select("id")
    .maybeSingle();
  if (updateError) {
    return {
      imageId: ref.id,
      title,
      status: "error",
      message: `Mise à jour en base : ${describeError(updateError, "échec inconnu.")}`,
    };
  }
  if (!updatedRow) {
    return { imageId: ref.id, title, status: "error", message: "Mise à jour silencieusement refusée (0 ligne)." };
  }

  return { imageId: ref.id, title, status: "done" };
}

export async function revalidateAfterQualityRepair() {
  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/boutique");
  revalidatePath("/oeuvres-recentes");
}
