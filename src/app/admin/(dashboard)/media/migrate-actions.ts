"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type MigrationState = {
  message: string | null;
  error: string | null;
};

function kindFromContentType(contentType: string): "image" | "gif" | "pdf" | "other" {
  if (contentType === "image/gif") return "gif";
  if (contentType.startsWith("image/")) return "image";
  if (contentType === "application/pdf") return "pdf";
  return "other";
}

function kindFromExtension(pathOrUrl: string): "image" | "gif" | "pdf" | "other" {
  const extension = pathOrUrl.split(".").pop()?.split("?")[0]?.toLowerCase();
  if (extension === "gif") return "gif";
  if (extension === "pdf") return "pdf";
  if (extension && ["jpg", "jpeg", "png", "webp", "avif", "svg", "bmp"].includes(extension)) {
    return "image";
  }
  return "other";
}

function mimeFromExtension(pathOrUrl: string): string {
  const kind = kindFromExtension(pathOrUrl);
  const extension = pathOrUrl.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "";
  if (kind === "pdf") return "application/pdf";
  if (kind === "gif") return "image/gif";
  if (kind === "image") return `image/${extension === "jpg" ? "jpeg" : extension}`;
  return "application/octet-stream";
}

// Synchronise les images des produits avec la Médiathèque :
// - si l'image est encore hébergée sur un lien externe (ex : ancien site
//   WooCommerce/Hostinger), elle est téléchargée et ré-uploadée dans
//   Supabase Storage (serveur à serveur, comme l'import CSV) ;
// - si elle est déjà dans notre Storage (l'import CSV la ré-uploade déjà
//   à l'import) mais n'a jamais été enregistrée comme entrée de la
//   Médiathèque, on se contente de créer cette entrée, sans re-uploader.
// Idempotent : relancer ce bouton ne retraite que ce qui manque encore.
export async function migrateExternalProductImages(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature attendue par useActionState
  _prevState: MigrationState,
): Promise<MigrationState> {
  const supabase = await createClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const [{ data: images, error }, { data: existingMedia }] = await Promise.all([
    supabase.from("product_images").select("id, product_id, path, url"),
    supabase.from("media").select("path"),
  ]);

  if (error) {
    return { message: null, error: `Erreur de lecture : ${error.message}` };
  }

  const cataloguedPaths = new Set((existingMedia ?? []).map((row) => row.path));
  const missing = (images ?? []).filter((image) => !cataloguedPaths.has(image.path));

  if (missing.length === 0) {
    return {
      message: "Toutes les images des produits sont déjà dans la Médiathèque.",
      error: null,
    };
  }

  let synced = 0;
  let reuploaded = 0;
  let failed = 0;

  for (const image of missing) {
    const isInternal = Boolean(supabaseUrl) && image.url.startsWith(supabaseUrl);

    if (isInternal) {
      // Déjà dans notre Storage (ex : import CSV) : on catalogue sans re-uploader.
      const filename = image.path.split("/").pop() ?? image.path;
      await supabase.from("media").insert({
        filename,
        path: image.path,
        url: image.url,
        mime_type: mimeFromExtension(image.path),
        kind: kindFromExtension(image.path),
        product_id: image.product_id,
      });
      synced += 1;
      continue;
    }

    try {
      const response = await fetch(image.url);
      if (!response.ok) {
        failed += 1;
        continue;
      }

      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      const buffer = await response.arrayBuffer();
      const extension = image.url.split(".").pop()?.split("?")[0]?.slice(0, 5) || "jpg";
      const filename = `${crypto.randomUUID()}.${extension}`;
      const path = `library/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(path, buffer, { contentType });
      if (uploadError) {
        failed += 1;
        continue;
      }

      const { data: publicUrlData } = supabase.storage.from("media").getPublicUrl(path);

      await supabase
        .from("product_images")
        .update({ path, url: publicUrlData.publicUrl })
        .eq("id", image.id);

      await supabase.from("media").insert({
        filename,
        path,
        url: publicUrlData.publicUrl,
        mime_type: contentType,
        kind: kindFromContentType(contentType),
        product_id: image.product_id,
      });

      reuploaded += 1;
    } catch {
      failed += 1;
    }
  }

  revalidatePath("/admin/media");
  revalidatePath("/admin/products");
  revalidatePath("/boutique");
  revalidatePath("/", "layout");

  const parts = [];
  if (synced > 0) parts.push(`${synced} déjà en ligne catalogué(e)(s)`);
  if (reuploaded > 0) parts.push(`${reuploaded} lien(s) externe(s) ré-uploadé(s)`);
  if (failed > 0) parts.push(`${failed} échec(s)`);

  return {
    message: `Terminé : ${parts.join(", ")}.`,
    error: null,
  };
}
