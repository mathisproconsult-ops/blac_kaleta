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
//
// Ne PAS exiger original_path non nul ici : une photo dont l'upload de
// l'original avait échoué à l'époque (original_path resté null, voir
// protectAndStoreArtworkImage dans lib/artwork-storage.ts) était
// silencieusement exclue de cette liste — jamais même tentée, donc jamais
// réparée malgré un filigrane cassé bien réel (bug remonté sur "Minions").
// regenerateProductWatermark retombe sur la copie publique actuelle quand
// l'original manque, comme c'est déjà le cas pour les entrées Photo.
//
// L'exclusion des produits Printify ne se fait PAS sur products.source :
// un produit catalogué Printify peut quand même porter une vraie œuvre
// uploadée à la main par l'artiste (cas de "Minions"), qui doit être
// filigranée comme les autres. Le seul signal fiable est le chemin de
// l'image elle-même : syncProductImages (printify-actions.ts) est le seul
// endroit de tout le code qui enregistre path/url comme l'URL externe
// Printify brute (image.src) plutôt qu'un chemin relatif dans notre
// propre bucket Storage — un upload manuel, un choix depuis la
// Médiathèque, ou un import CSV stockent TOUJOURS un chemin relatif. Une
// image dont path est une URL http(s) n'a donc jamais été touchée par un
// upload réel : c'est la maquette Printify telle quelle, qu'on ne possède
// pas et qu'on ne doit pas filigraner.
export async function listImagesNeedingWatermarkRefresh(): Promise<{
  images: WatermarkImageRef[];
  error: string | null;
}> {
  const supabase = await createClient();

  const { data: productRows, error: productError } = await supabase
    .from("product_images")
    .select("id, path")
    .order("id", { ascending: true });

  if (productError) {
    console.error("listImagesNeedingWatermarkRefresh products", productError);
    return { images: [], error: productError.message };
  }

  const productImages = ((productRows ?? []) as { id: number; path: string | null }[])
    .filter((row) => !/^https?:\/\//i.test(row.path ?? ""))
    .filter((row) => !row.path?.toLowerCase().endsWith(".gif"))
    .map((row): WatermarkImageRef => ({ kind: "product", id: row.id }));

  // "video" est inclus en plus de "photo" : une vidéo auto-hébergée a sa
  // propre vignette (image_path pointant vers un fichier brut dans le
  // bucket "media", jamais protégé jusqu'ici — voir createRecentWorkVideoUpload
  // dans [id]/actions.ts), qui fait bien partie de la catégorie "Production
  // Vidéos" visée par le filigrane. Le filtre image_path non nul exclut déjà
  // naturellement les liens vidéo externes (YouTube/Vimeo/Instagram/TikTok),
  // qui n'ont qu'une vignette externe (image_url) qu'on ne possède pas et ne
  // doit pas filigraner.
  const { data: mediaRows, error: mediaError } = await supabase
    .from("recent_work_media")
    .select("id")
    .in("kind", ["photo", "video"])
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

// Tente les emplacements possibles dans l'ordre, et s'arrête au premier qui
// répond : original jamais filigrané (artwork-originals) > copie publique
// déjà filigranée (products — l'original a été perdu, mais le pipeline
// avait bien tourné) > fichier brut jamais traité (media — le pipeline de
// protection avait échoué silencieusement à l'ajout, voir
// protectAndStoreArtworkImage dans lib/artwork-storage.ts, qui retombe alors
// sur le chemin brut tel quel : aucun filigrane n'a jamais existé pour cette
// image, elle est restée dans le bucket "media" où elle a été uploadée).
// C'est cette dernière étape qui manquait et causait l'erreur "Object not
// found" : la photo n'avait jamais été copiée dans "products", donc y
// chercher ne pouvait que la rater.
async function downloadFirstAvailable(
  supabase: SupabaseClient,
  candidates: { bucket: string; path: string }[],
): Promise<{ buffer: Buffer | null; error: unknown }> {
  let lastError: unknown = null;
  for (const { bucket, path } of candidates) {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (data) return { buffer: Buffer.from(await data.arrayBuffer()), error: null };
    lastError = error;
  }
  return { buffer: null, error: lastError };
}

// Bucket privé, jamais servi au navigateur : le type exact importe peu, mais
// autant rester correct plutôt que de tout marquer "octet-stream".
async function guessImageContentType(buffer: Buffer): Promise<string> {
  try {
    const sharp = (await import("sharp")).default;
    const format = (await sharp(buffer).metadata()).format;
    if (format === "jpeg" || format === "jpg") return "image/jpeg";
    if (format) return `image/${format}`;
  } catch {
    // ignore — retombe sur le type générique ci-dessous
  }
  return "application/octet-stream";
}

// Retrouve un original "orphelin" : avant ce correctif, régénérer une
// entrée Photo/Vidéo changeait image_path sans jamais réécrire
// artwork-originals, donc l'original resté là-bas (à l'ancien chemin,
// jamais noté nulle part : ces entrées n'ont pas de colonne original_path
// contrairement aux produits) devenait introuvable par chemin exact — la
// régénération suivante retombait alors sur la copie "products" déjà
// filigranée et empilait un second filigrane par-dessus (bug remonté sur
// "À l'aurore"). Avant ce correctif, rien n'écrivait JAMAIS dans
// artwork-originals pour ces entrées en dehors de l'ajout initial : un
// dossier recent-works/{catégorie} qui ne contient qu'UN seul fichier ne
// peut donc être que cet original orphelin, sans ambiguïté possible.
// Plusieurs fichiers = ambigu (plusieurs photos dans la même catégorie) :
// on ne devine pas, on laisse retomber sur les autres sources.
async function findOrphanedOriginal(supabase: SupabaseClient, folder: string): Promise<Buffer | null> {
  const { data: files } = await supabase.storage.from("artwork-originals").list(folder);
  if (!files || files.length !== 1) return null;
  const { data: downloaded } = await supabase.storage
    .from("artwork-originals")
    .download(`${folder}/${files[0].name}`);
  return downloaded ? Buffer.from(await downloaded.arrayBuffer()) : null;
}

async function regenerateProductWatermark(
  supabase: SupabaseClient,
  id: number,
): Promise<WatermarkResult> {
  const { data: image, error } = await supabase
    .from("product_images")
    .select("product_id, path, original_path, products(title)")
    .eq("id", id)
    .maybeSingle();

  if (error || !image) return { status: "error", message: "Photo introuvable." };
  const context = {
    productId: image.product_id,
    title: (image as { products?: { title?: string } | null }).products?.title,
  };
  if (!image.path) {
    return { status: "skipped", message: "Pas d'image.", ...context };
  }
  if (/^https?:\/\//i.test(image.path)) {
    return { status: "skipped", message: "Image externe (Printify), non filigranée.", ...context };
  }
  if (image.path.toLowerCase().endsWith(".gif")) {
    return { status: "skipped", message: "GIF animé, non retraité.", ...context };
  }

  // Priorité à l'original jamais filigrané (bucket privé artwork-originals).
  // S'il manque, on retombe sur la copie publique actuelle dans "products"
  // (déjà filigranée — le pipeline avait tourné mais l'original a été perdu
  // depuis). Et si celle-ci manque aussi, on tente enfin "media" : le
  // fichier brut tel qu'uploadé, jamais copié nulle part ailleurs parce que
  // le pipeline de protection avait échoué silencieusement à l'ajout (voir
  // protectAndStoreArtworkImage) — ce cas précis n'avait aucun filigrane du
  // tout (pas même cassé), et provoquait l'erreur "Object not found" tant
  // qu'on ne cherchait que dans "products".
  const candidates: { bucket: string; path: string }[] = [];
  if (image.original_path) candidates.push({ bucket: "artwork-originals", path: image.original_path });
  candidates.push({ bucket: "products", path: image.path }, { bucket: "media", path: image.path });

  const { buffer: sourceBuffer, error: downloadError } = await downloadFirstAvailable(supabase, candidates);
  if (!sourceBuffer) {
    return {
      status: "error",
      message: describeError(downloadError, "Image introuvable dans le Storage (fichier manquant)."),
      ...context,
    };
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

  const destPath = `${image.product_id}/${id}-${Date.now()}.${protectedImage.extension}`;
  const thumbDestPath = `${image.product_id}/${id}-${Date.now()}-thumb.${thumbnailImage.extension}`;

  // Réécrit aussi l'original propre (jamais filigrané) dans
  // artwork-originals, au même chemin que la copie publique — exactement le
  // contrat de protectAndStoreArtworkImage à l'ajout initial. Sans ça,
  // original_path restait orphelin après une régénération (pointant vers un
  // fichier qui n'existe peut-être plus, ou simplement jamais mis à jour) :
  // la régénération SUIVANTE ne retrouvait plus de source propre et
  // retombait sur la copie déjà filigranée, empilant un second filigrane.
  const [publicUpload, thumbnailUpload, originalUpload] = await Promise.all([
    supabase.storage.from("products").upload(destPath, protectedImage.buffer, {
      contentType: protectedImage.contentType,
      cacheControl: "31536000",
    }),
    supabase.storage.from("products").upload(thumbDestPath, thumbnailImage.buffer, {
      contentType: thumbnailImage.contentType,
      cacheControl: "31536000",
    }),
    supabase.storage
      .from("artwork-originals")
      .upload(destPath, sourceBuffer, {
        contentType: await guessImageContentType(sourceBuffer),
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
  if (!originalUpload.error) {
    updates.original_path = destPath;
  }

  // .select() est indispensable ici : un update() bloqué par une policy RLS
  // ne renvoie PAS d'erreur côté Supabase JS quand aucune ligne autorisée
  // ne correspond — juste un succès silencieux avec 0 ligne modifiée. Sans
  // .select() pour vérifier qu'une ligne est bien revenue, ce cas est
  // indiscernable d'une vraie réussite (bug réel rencontré : il manquait une
  // policy UPDATE sur product_images, voir migration 0042).
  const { data: updatedRow, error: updateError } = await supabase
    .from("product_images")
    .update(updates)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (updateError) {
    return { status: "error", message: describeError(updateError, "Échec de mise à jour."), ...context };
  }
  if (!updatedRow) {
    return {
      status: "error",
      message: "Mise à jour silencieusement refusée (0 ligne modifiée — vérifie les policies RLS).",
      ...context,
    };
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

  const destFolder = `recent-works/${media.recent_work_category_id}`;

  // Les entrées Photo/Vidéo d'Œuvres récentes ne conservent pas de référence
  // explicite à leur original (contrairement aux produits) — on tente donc
  // "artwork-originals" au même chemin que image_path. Si l'original n'y
  // est pas À CE chemin précis, avant de abandonner et retomber sur la
  // copie déjà filigranée, on cherche un original orphelin dans le dossier
  // (voir findOrphanedOriginal) : une régénération précédente peut avoir
  // changé image_path sans jamais réécrire artwork-originals, laissant
  // l'original propre à son chemin d'origine, introuvable autrement — c'est
  // exactement ce qui causait le filigrane doublé sur "À l'aurore". Ce
  // correctif réécrit désormais artwork-originals à chaque régénération
  // (voir plus bas), donc ce repli ne devrait plus être nécessaire après ce
  // premier passage. En dernier recours : "products" (déjà filigranée) puis
  // "media" (vignette jamais traitée, ex. vidéo auto-hébergée).
  let sourceBuffer: Buffer | null = null;
  let downloadError: unknown = null;
  const exactOriginal = await supabase.storage.from("artwork-originals").download(media.image_path);
  if (exactOriginal.data) {
    sourceBuffer = Buffer.from(await exactOriginal.data.arrayBuffer());
  } else {
    sourceBuffer = await findOrphanedOriginal(supabase, destFolder);
    if (!sourceBuffer) {
      const fallback = await downloadFirstAvailable(supabase, [
        { bucket: "products", path: media.image_path },
        { bucket: "media", path: media.image_path },
      ]);
      sourceBuffer = fallback.buffer;
      downloadError = fallback.error;
    }
  }
  if (!sourceBuffer) {
    return {
      status: "error",
      message: describeError(downloadError, "Image introuvable dans le Storage (fichier manquant)."),
      ...context,
    };
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

  const destPath = `${destFolder}/${id}-${Date.now()}.${protectedImage.extension}`;
  const thumbDestPath = `${destFolder}/${id}-${Date.now()}-thumb.${thumbnailImage.extension}`;

  // Réécrit l'original propre dans artwork-originals au même chemin que la
  // nouvelle copie publique : rétablit la convention "même chemin, bucket
  // différent" pour la PROCHAINE régénération, qui le retrouvera cette fois
  // par correspondance exacte au lieu de devoir chercher un orphelin.
  const [publicUpload, thumbnailUpload] = await Promise.all([
    supabase.storage.from("products").upload(destPath, protectedImage.buffer, {
      contentType: protectedImage.contentType,
      cacheControl: "31536000",
    }),
    supabase.storage.from("products").upload(thumbDestPath, thumbnailImage.buffer, {
      contentType: thumbnailImage.contentType,
      cacheControl: "31536000",
    }),
    supabase.storage
      .from("artwork-originals")
      .upload(destPath, sourceBuffer, {
        contentType: await guessImageContentType(sourceBuffer),
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

  // Voir le commentaire équivalent dans regenerateProductWatermark : un
  // update() bloqué par RLS ne renvoie pas d'erreur sans .select() pour
  // vérifier qu'une ligne est bien revenue.
  const { data: updatedRow, error: updateError } = await supabase
    .from("recent_work_media")
    .update(updates)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (updateError) {
    return { status: "error", message: describeError(updateError, "Échec de mise à jour."), ...context };
  }
  if (!updatedRow) {
    return {
      status: "error",
      message: "Mise à jour silencieusement refusée (0 ligne modifiée — vérifie les policies RLS).",
      ...context,
    };
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
