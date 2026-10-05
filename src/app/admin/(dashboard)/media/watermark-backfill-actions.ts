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
  // S'il manque, on tente "media" : le fichier brut tel qu'uploadé, jamais
  // copié nulle part ailleurs parce que le pipeline de protection avait
  // échoué silencieusement à l'ajout (voir protectAndStoreArtworkImage) —
  // ce cas précis n'avait aucun filigrane du tout (pas même cassé).
  //
  // Jamais de repli sur "products" (la copie publique déjà filigranée) :
  // repartir de cette copie pour appliquer un NOUVEAU filigrane peinturlure
  // le nouveau par-dessus l'ancien, encore visible dans les pixels, et ajoute
  // un second passage de compression WebP par-dessus un premier déjà
  // disparu — exactement le bug constaté sur "À l'aurore" et le risque
  // signalé pour les images repérées par l'outil de vérification qualité
  // (admin/media, "suspecte mais non réparable automatiquement") : sans
  // original fiable, mieux vaut ignorer l'image que la dégrader en silence.
  const candidates: { bucket: string; path: string }[] = [];
  if (image.original_path) candidates.push({ bucket: "artwork-originals", path: image.original_path });
  candidates.push({ bucket: "media", path: image.path });

  const { buffer: sourceBuffer } = await downloadFirstAvailable(supabase, candidates);
  if (!sourceBuffer) {
    return {
      status: "error",
      message:
        "Original introuvable : régénération ignorée pour ne pas doubler le filigrane et la compression. " +
        "Réuploade l'original depuis la fiche produit (ou via l'outil de vérification qualité, Médiathèque), " +
        "puis relance la régénération.",
      ...context,
    };
  }

  let protectedImage, thumbnailImage, hqImage;
  try {
    const { protectArtworkImage, THUMBNAIL_MAX_DIMENSION } = await import("@/lib/image-protection");
    const { getSettings } = await import("@/lib/settings");
    const settings = await getSettings();
    [protectedImage, thumbnailImage, hqImage] = await Promise.all([
      protectArtworkImage(sourceBuffer),
      protectArtworkImage(sourceBuffer, THUMBNAIL_MAX_DIMENSION),
      protectArtworkImage(sourceBuffer, settings.image_hq_max_dimension, settings.image_hq_quality),
    ]);
  } catch (err) {
    return {
      status: "error",
      message: `Traitement de l'image : ${describeError(err, "échec inconnu.")}`,
      ...context,
    };
  }

  const destPath = `${image.product_id}/${id}-${Date.now()}.${protectedImage.extension}`;
  const thumbDestPath = `${image.product_id}/${id}-${Date.now()}-thumb.${thumbnailImage.extension}`;
  const hqDestPath = `${image.product_id}/${id}-${Date.now()}-hq.${hqImage.extension}`;

  // Réécrit aussi l'original propre (jamais filigrané) dans
  // artwork-originals, au même chemin que la copie publique — exactement le
  // contrat de protectAndStoreArtworkImage à l'ajout initial. Sans ça,
  // original_path restait orphelin après une régénération (pointant vers un
  // fichier qui n'existe peut-être plus, ou simplement jamais mis à jour) :
  // la régénération SUIVANTE ne retrouvait plus de source propre et
  // retombait sur la copie déjà filigranée, empilant un second filigrane.
  const [publicUpload, thumbnailUpload, originalUpload, hqUpload] = await Promise.all([
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
    supabase.storage.from("products").upload(hqDestPath, hqImage.buffer, {
      contentType: hqImage.contentType,
      cacheControl: "31536000",
    }),
  ]);
  if (publicUpload.error) {
    return {
      status: "error",
      message: `Envoi de l'image : ${describeError(publicUpload.error, "échec inconnu.")}`,
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
  if (!hqUpload.error) {
    const { data: hqUrlData } = supabase.storage.from("products").getPublicUrl(hqDestPath);
    updates.high_quality_path = hqDestPath;
    updates.high_quality_url = hqUrlData.publicUrl;
    updates.high_quality_width = hqImage.width;
    updates.high_quality_height = hqImage.height;
  }

  // .select() est indispensable ici : un update() bloqué (policy RLS,
  // trigger, ou toute autre raison côté base) ne renvoie PAS forcément
  // d'erreur côté Supabase JS quand aucune ligne ne correspond — juste un
  // succès silencieux avec 0 ligne modifiée. Sans .select() pour vérifier
  // qu'une ligne est bien revenue, ce cas est indiscernable d'une vraie
  // réussite.
  let { data: updatedRow, error: updateError } = await supabase
    .from("product_images")
    .update(updates)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  // Les colonnes high_quality_* peuvent ne pas encore exister si la
  // migration 0043 n'a pas été appliquée : retente sans elles plutôt que
  // de perdre la régénération du filigrane/vignette pour autant.
  if (updateError && "high_quality_path" in updates) {
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      high_quality_path: _hqp,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      high_quality_url: _hqu,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      high_quality_width: _hqw,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      high_quality_height: _hqh,
      ...updatesWithoutHq
    } = updates;
    const retry = await supabase
      .from("product_images")
      .update(updatesWithoutHq)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    updatedRow = retry.data;
    updateError = retry.error;
  }
  if (updateError) {
    return {
      status: "error",
      message: `Mise à jour en base : ${describeError(updateError, "échec inconnu.")}`,
      ...context,
    };
  }
  if (!updatedRow) {
    return {
      status: "error",
      message: "Mise à jour en base silencieusement refusée (0 ligne modifiée).",
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
  // est pas à ce chemin précis, on cherche un original orphelin dans le
  // dossier (voir findOrphanedOriginal) : une régénération précédente peut
  // avoir changé image_path sans jamais réécrire artwork-originals, laissant
  // l'original propre à son chemin d'origine, introuvable autrement — c'est
  // exactement ce qui causait le filigrane doublé sur "À l'aurore". Ce
  // correctif réécrit désormais artwork-originals à chaque régénération
  // (voir plus bas), donc ce repli ne devrait plus être nécessaire après ce
  // premier passage. Dernier recours : "media", la vignette jamais traitée
  // (ex. vidéo auto-hébergée) — jamais "products" (la copie déjà filigranée) :
  // voir le commentaire équivalent dans regenerateProductWatermark, même
  // risque de filigrane et compression doublés.
  let sourceBuffer: Buffer | null = null;
  let downloadError: unknown = null;
  const exactOriginal = await supabase.storage.from("artwork-originals").download(media.image_path);
  if (exactOriginal.data) {
    sourceBuffer = Buffer.from(await exactOriginal.data.arrayBuffer());
  } else {
    sourceBuffer = await findOrphanedOriginal(supabase, destFolder);
    if (!sourceBuffer) {
      const fallback = await downloadFirstAvailable(supabase, [{ bucket: "media", path: media.image_path }]);
      sourceBuffer = fallback.buffer;
      downloadError = fallback.error;
    }
  }
  if (!sourceBuffer) {
    return {
      status: "error",
      message:
        "Original introuvable : régénération ignorée pour ne pas doubler le filigrane et la compression. " +
        `Réuploade l'original depuis Œuvres récentes, puis relance la régénération. (${describeError(downloadError, "fichier manquant dans le Storage.")})`,
      ...context,
    };
  }

  let protectedImage, thumbnailImage, hqImage;
  try {
    const { protectArtworkImage, THUMBNAIL_MAX_DIMENSION } = await import("@/lib/image-protection");
    const { getSettings } = await import("@/lib/settings");
    const settings = await getSettings();
    [protectedImage, thumbnailImage, hqImage] = await Promise.all([
      protectArtworkImage(sourceBuffer),
      protectArtworkImage(sourceBuffer, THUMBNAIL_MAX_DIMENSION),
      protectArtworkImage(sourceBuffer, settings.image_hq_max_dimension, settings.image_hq_quality),
    ]);
  } catch (err) {
    return {
      status: "error",
      message: `Traitement de l'image : ${describeError(err, "échec inconnu.")}`,
      ...context,
    };
  }

  const destPath = `${destFolder}/${id}-${Date.now()}.${protectedImage.extension}`;
  const thumbDestPath = `${destFolder}/${id}-${Date.now()}-thumb.${thumbnailImage.extension}`;
  const hqDestPath = `${destFolder}/${id}-${Date.now()}-hq.${hqImage.extension}`;

  // Réécrit l'original propre dans artwork-originals au même chemin que la
  // nouvelle copie publique : rétablit la convention "même chemin, bucket
  // différent" pour la PROCHAINE régénération, qui le retrouvera cette fois
  // par correspondance exacte au lieu de devoir chercher un orphelin.
  const [publicUpload, thumbnailUpload, , hqUpload] = await Promise.all([
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
    supabase.storage.from("products").upload(hqDestPath, hqImage.buffer, {
      contentType: hqImage.contentType,
      cacheControl: "31536000",
    }),
  ]);
  if (publicUpload.error) {
    return {
      status: "error",
      message: `Envoi de l'image : ${describeError(publicUpload.error, "échec inconnu.")}`,
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
  if (!hqUpload.error) {
    const { data: hqUrlData } = supabase.storage.from("products").getPublicUrl(hqDestPath);
    updates.high_quality_path = hqDestPath;
    updates.high_quality_url = hqUrlData.publicUrl;
    updates.high_quality_width = hqImage.width;
    updates.high_quality_height = hqImage.height;
  }

  // Voir le commentaire équivalent dans regenerateProductWatermark : un
  // update() bloqué ne renvoie pas forcément d'erreur sans .select() pour
  // vérifier qu'une ligne est bien revenue. Et les colonnes high_quality_*
  // peuvent elles aussi ne pas encore exister (migration 0043) : même repli.
  let { data: updatedRow, error: updateError } = await supabase
    .from("recent_work_media")
    .update(updates)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (updateError && "high_quality_path" in updates) {
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      high_quality_path: _hqp,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      high_quality_url: _hqu,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      high_quality_width: _hqw,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      high_quality_height: _hqh,
      ...updatesWithoutHq
    } = updates;
    const retry = await supabase
      .from("recent_work_media")
      .update(updatesWithoutHq)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    updatedRow = retry.data;
    updateError = retry.error;
  }
  if (updateError) {
    return {
      status: "error",
      message: `Mise à jour en base : ${describeError(updateError, "échec inconnu.")}`,
      ...context,
    };
  }
  if (!updatedRow) {
    return {
      status: "error",
      message: "Mise à jour en base silencieusement refusée (0 ligne modifiée).",
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
