import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type StoredArtworkImage = {
  path: string;
  url: string;
  originalPath: string | null;
  thumbnailPath: string | null;
  thumbnailUrl: string | null;
};

// Télécharge le fichier tel qu'envoyé (bucket "media", où atterrissent tous
// les uploads bruts) puis produit la copie publique redimensionnée et
// filigranée dans le bucket "products", en conservant l'original intact
// dans le bucket privé "artwork-originals" (jamais exposé publiquement).
// Produit aussi une vignette plus légère (voir THUMBNAIL_MAX_DIMENSION),
// destinée aux grilles (Boutique, Œuvres récentes) qui n'ont jamais besoin
// de la pleine résolution. Les GIFs animés ne sont pas retraités
// (filigraner/redimensionner image par image est hors scope) : ils
// restent servis tels quels, sans protection ni vignette dédiée.
//
// Partagé entre les produits (destFolder = id du produit) et les entrées
// Photo d'Œuvres récentes (destFolder = "recent-works/{catégorie}") — même
// pipeline de protection partout où une photo d'œuvre est affichée
// publiquement.
export async function protectAndStoreArtworkImage(
  supabase: SupabaseClient,
  destFolder: string,
  sourcePath: string,
  mimeType: string,
): Promise<StoredArtworkImage | null> {
  if (mimeType === "image/gif") {
    const { data } = supabase.storage.from("media").getPublicUrl(sourcePath);
    return {
      path: sourcePath,
      url: data.publicUrl,
      originalPath: null,
      thumbnailPath: null,
      thumbnailUrl: null,
    };
  }

  const { data: downloaded, error: downloadError } = await supabase.storage
    .from("media")
    .download(sourcePath);
  if (downloadError || !downloaded) {
    console.error("protectAndStoreArtworkImage download", sourcePath, downloadError);
    return null;
  }

  const originalBuffer = Buffer.from(await downloaded.arrayBuffer());

  let protectedImage;
  let thumbnailImage;
  try {
    // Import différé : sharp ne doit être chargé que lors d'un ajout de
    // photo, jamais au simple affichage d'une page qui importe ce fichier
    // pour ses autres actions (liste des produits, etc.).
    const { protectArtworkImage, THUMBNAIL_MAX_DIMENSION } = await import("@/lib/image-protection");
    [protectedImage, thumbnailImage] = await Promise.all([
      protectArtworkImage(originalBuffer),
      protectArtworkImage(originalBuffer, THUMBNAIL_MAX_DIMENSION),
    ]);
  } catch (err) {
    console.error("protectAndStoreArtworkImage process", sourcePath, err);
    return null;
  }

  const destPath = `${destFolder}/${crypto.randomUUID()}.${protectedImage.extension}`;
  const thumbnailDestPath = `${destFolder}/${crypto.randomUUID()}-thumb.${thumbnailImage.extension}`;

  const [publicUpload, originalUpload, thumbnailUpload] = await Promise.all([
    supabase.storage
      .from("products")
      .upload(destPath, protectedImage.buffer, { contentType: protectedImage.contentType }),
    supabase.storage
      .from("artwork-originals")
      .upload(destPath, originalBuffer, { contentType: mimeType }),
    supabase.storage
      .from("products")
      .upload(thumbnailDestPath, thumbnailImage.buffer, { contentType: thumbnailImage.contentType }),
  ]);

  if (publicUpload.error) {
    console.error("protectAndStoreArtworkImage publicUpload", destPath, publicUpload.error);
    return null;
  }
  if (originalUpload.error) {
    console.error("protectAndStoreArtworkImage originalUpload", destPath, originalUpload.error);
  }
  if (thumbnailUpload.error) {
    console.error("protectAndStoreArtworkImage thumbnailUpload", thumbnailDestPath, thumbnailUpload.error);
  }

  const { data: publicUrlData } = supabase.storage.from("products").getPublicUrl(destPath);
  const { data: thumbnailUrlData } = supabase.storage.from("products").getPublicUrl(thumbnailDestPath);

  return {
    path: destPath,
    url: publicUrlData.publicUrl,
    // La copie publique protégée est déjà en ligne : si seul l'upload de
    // l'original a échoué, on continue sans original téléchargeable plutôt
    // que de perdre toute la photo.
    originalPath: originalUpload.error ? null : destPath,
    // Idem pour la vignette : une grille peut toujours retomber sur
    // l'image pleine résolution si elle manque (voir les pages publiques).
    thumbnailPath: thumbnailUpload.error ? null : thumbnailDestPath,
    thumbnailUrl: thumbnailUpload.error ? null : thumbnailUrlData.publicUrl,
  };
}

// Produit et stocke la vignette floutée servie par défaut pour le contenu
// +18 tant que l'âge n'est pas vérifié (voir age-gate.tsx). Prend le buffer
// source directement (déjà en mémoire, quelle que soit sa provenance :
// fichier uploadé, vignette vidéo déjà en stockage, ou vignette externe
// YouTube/Vimeo/Instagram/TikTok téléchargée pour l'occasion).
export async function createBlurredArtworkPreview(
  supabase: SupabaseClient,
  destFolder: string,
  sourceBuffer: Buffer,
): Promise<{ path: string; url: string } | null> {
  let blurred;
  try {
    const { blurArtworkImage } = await import("@/lib/image-protection");
    blurred = await blurArtworkImage(sourceBuffer);
  } catch (err) {
    console.error("createBlurredArtworkPreview process", err);
    return null;
  }

  const destPath = `${destFolder}/${crypto.randomUUID()}-blur.${blurred.extension}`;
  const { error } = await supabase.storage
    .from("products")
    .upload(destPath, blurred.buffer, { contentType: blurred.contentType });

  if (error) {
    console.error("createBlurredArtworkPreview upload", destPath, error);
    return null;
  }

  const { data: publicUrlData } = supabase.storage.from("products").getPublicUrl(destPath);
  return { path: destPath, url: publicUrlData.publicUrl };
}

// Variante pratique de createBlurredArtworkPreview quand la source est déjà
// dans un bucket Supabase (image produit déjà protégée, vignette vidéo déjà
// uploadée) plutôt qu'un buffer déjà en mémoire — télécharge puis délègue.
export async function blurStoredImage(
  supabase: SupabaseClient,
  destFolder: string,
  sourceBucket: string,
  sourcePath: string,
): Promise<{ path: string; url: string } | null> {
  const { data: downloaded, error } = await supabase.storage.from(sourceBucket).download(sourcePath);
  if (error || !downloaded) {
    console.error("blurStoredImage download", sourceBucket, sourcePath, error);
    return null;
  }
  return createBlurredArtworkPreview(supabase, destFolder, Buffer.from(await downloaded.arrayBuffer()));
}

// Optimise et stocke une image "de décor" (logo, couverture de catégorie,
// image de popup, image de bloc de page) : ni filigrane ni original
// conservé à part, juste un redimensionnement raisonnable + WebP avant
// upload — ces images sont sinon stockées telles quelles, dans le format
// et la taille du fichier envoyé par l'admin. Les GIFs animés passent tels
// quels (non traitables par ce pipeline).
export async function optimizeAndStoreDecorImage(
  supabase: SupabaseClient,
  bucket: string,
  destFolder: string,
  file: File,
): Promise<{ path: string; url: string } | null> {
  if (file.type === "image/gif") {
    const path = `${destFolder}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
    if (error) {
      console.error("optimizeAndStoreDecorImage gif upload", path, error);
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return { path, url: data.publicUrl };
  }

  let optimized;
  try {
    const { optimizeDecorImage } = await import("@/lib/image-protection");
    optimized = await optimizeDecorImage(Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    console.error("optimizeAndStoreDecorImage process", err);
    return null;
  }

  const path = `${destFolder}/${crypto.randomUUID()}.${optimized.extension}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, optimized.buffer, { contentType: optimized.contentType });
  if (error) {
    console.error("optimizeAndStoreDecorImage upload", path, error);
    return null;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { path, url: data.publicUrl };
}
