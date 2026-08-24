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
// pipeline de protection (original_path pas encore renseigné) — utilisé par
// le bouton du dashboard pour connaître le total avant de traiter photo par
// photo et afficher une progression réelle.
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
  const images = rows
    .filter((row) => row.products?.source !== "printify")
    .map((row) => ({ id: row.id, productId: row.product_id }));

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
  if (image.original_path) {
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
    const originalBuffer = Buffer.from(await downloaded.arrayBuffer());

    // Import différé : sharp ne doit être chargé que lors d'un retraitement
    // effectif, jamais au simple affichage de la Médiathèque.
    const { protectArtworkImage } = await import("@/lib/image-protection");
    const protectedImage = await protectArtworkImage(originalBuffer);
    const destPath = `${image.product_id}/${imageId}-${Date.now()}.${protectedImage.extension}`;

    const { error: originalUploadError } = await supabase.storage
      .from("artwork-originals")
      .upload(destPath, originalBuffer, { contentType: "image/*", upsert: true });
    if (originalUploadError) throw new Error(`original : ${originalUploadError.message}`);

    const { error: publicUploadError } = await supabase.storage
      .from("products")
      .upload(destPath, protectedImage.buffer, {
        contentType: protectedImage.contentType,
        upsert: true,
      });
    if (publicUploadError) throw new Error(`public : ${publicUploadError.message}`);

    const { data: publicUrlData } = supabase.storage.from("products").getPublicUrl(destPath);

    const { error: updateError } = await supabase
      .from("product_images")
      .update({ path: destPath, url: publicUrlData.publicUrl, original_path: destPath })
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
