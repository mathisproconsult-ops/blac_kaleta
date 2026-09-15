import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type StoredArtworkImage = { path: string; url: string; originalPath: string | null };

// Télécharge le fichier tel qu'envoyé (bucket "media", où atterrissent tous
// les uploads bruts) puis produit la copie publique redimensionnée et
// filigranée dans le bucket "products", en conservant l'original intact
// dans le bucket privé "artwork-originals" (jamais exposé publiquement).
// Les GIFs animés ne sont pas retraités (filigraner image par image est
// hors scope) : ils restent servis tels quels, sans protection.
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
    return { path: sourcePath, url: data.publicUrl, originalPath: null };
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
  try {
    // Import différé : sharp ne doit être chargé que lors d'un ajout de
    // photo, jamais au simple affichage d'une page qui importe ce fichier
    // pour ses autres actions (liste des produits, etc.).
    const { protectArtworkImage } = await import("@/lib/image-protection");
    protectedImage = await protectArtworkImage(originalBuffer);
  } catch (err) {
    console.error("protectAndStoreArtworkImage process", sourcePath, err);
    return null;
  }

  const destPath = `${destFolder}/${crypto.randomUUID()}.${protectedImage.extension}`;

  const [publicUpload, originalUpload] = await Promise.all([
    supabase.storage
      .from("products")
      .upload(destPath, protectedImage.buffer, { contentType: protectedImage.contentType }),
    supabase.storage
      .from("artwork-originals")
      .upload(destPath, originalBuffer, { contentType: mimeType }),
  ]);

  if (publicUpload.error) {
    console.error("protectAndStoreArtworkImage publicUpload", destPath, publicUpload.error);
    return null;
  }
  if (originalUpload.error) {
    console.error("protectAndStoreArtworkImage originalUpload", destPath, originalUpload.error);
  }

  const { data: publicUrlData } = supabase.storage.from("products").getPublicUrl(destPath);

  return {
    path: destPath,
    url: publicUrlData.publicUrl,
    // La copie publique protégée est déjà en ligne : si seul l'upload de
    // l'original a échoué, on continue sans original téléchargeable plutôt
    // que de perdre toute la photo.
    originalPath: originalUpload.error ? null : destPath,
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
