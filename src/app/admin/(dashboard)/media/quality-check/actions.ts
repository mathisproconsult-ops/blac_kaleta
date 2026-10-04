"use server";

import { createClient } from "@/lib/supabase/server";

export type QualityCheckResult = {
  imageId: number;
  title: string;
  error: string | null;
  current: {
    width: number;
    height: number;
    bytes: number;
    cropDataUrl: string;
  } | null;
  original: {
    width: number;
    height: number;
    bytes: number;
    cropDataUrl: string;
  } | null;
};

const CROP_SIZE = 240;

// Découpe un carré de CROP_SIZE pixels AU CENTRE, à résolution native (sans
// mise à l'échelle) — comparer deux crops de même taille en pixels bruts
// révèle directement une perte de détail (flou, blocs de compression) entre
// la version publiée et l'original, contrairement à comparer les images
// entières à des résolutions différentes.
async function cropCenterAsDataUrl(buffer: Buffer): Promise<{ width: number; height: number; dataUrl: string }> {
  const sharp = (await import("sharp")).default;
  const image = sharp(buffer).rotate();
  const metadata = await image.metadata();
  const width = metadata.width ?? CROP_SIZE;
  const height = metadata.height ?? CROP_SIZE;
  const cropWidth = Math.min(CROP_SIZE, width);
  const cropHeight = Math.min(CROP_SIZE, height);
  const left = Math.max(0, Math.floor((width - cropWidth) / 2));
  const top = Math.max(0, Math.floor((height - cropHeight) / 2));
  const cropBuffer = await image
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .png()
    .toBuffer();
  return { width, height, dataUrl: `data:image/png;base64,${cropBuffer.toString("base64")}` };
}

export async function checkImageQuality(imageId: number): Promise<QualityCheckResult> {
  const supabase = await createClient();

  const { data: image, error } = await supabase
    .from("product_images")
    .select("id, path, original_path, products(title)")
    .eq("id", imageId)
    .maybeSingle();

  const title = (image as { products?: { title?: string } | null } | null)?.products?.title ?? `Image #${imageId}`;

  if (error || !image) {
    return { imageId, title, error: "Image introuvable.", current: null, original: null };
  }

  let current: QualityCheckResult["current"] = null;
  let original: QualityCheckResult["original"] = null;
  const errors: string[] = [];

  if (image.path) {
    const { data: downloaded, error: downloadError } = await supabase.storage.from("products").download(image.path);
    if (downloaded) {
      const buffer = Buffer.from(await downloaded.arrayBuffer());
      const crop = await cropCenterAsDataUrl(buffer);
      current = { width: crop.width, height: crop.height, bytes: buffer.length, cropDataUrl: crop.dataUrl };
    } else {
      errors.push(`Fichier actuel introuvable : ${downloadError?.message ?? "erreur inconnue"}`);
    }
  } else {
    errors.push("Pas de chemin actuel enregistré.");
  }

  if (image.original_path) {
    const { data: downloaded, error: downloadError } = await supabase.storage
      .from("artwork-originals")
      .download(image.original_path);
    if (downloaded) {
      const buffer = Buffer.from(await downloaded.arrayBuffer());
      const crop = await cropCenterAsDataUrl(buffer);
      original = { width: crop.width, height: crop.height, bytes: buffer.length, cropDataUrl: crop.dataUrl };
    } else {
      errors.push(`Original introuvable dans artwork-originals : ${downloadError?.message ?? "erreur inconnue"}`);
    }
  } else {
    errors.push("Pas d'original enregistré (original_path vide).");
  }

  return { imageId, title, error: errors.length > 0 ? errors.join(" / ") : null, current, original };
}
