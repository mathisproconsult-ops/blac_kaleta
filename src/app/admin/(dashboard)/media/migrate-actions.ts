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

// Ré-uploade dans Supabase Storage toute image de produit encore hébergée
// sur un lien externe (ex : ancien site WooCommerce/Hostinger) — même
// logique que l'import CSV : téléchargement serveur à serveur, donc pas
// concerné par la limite de taille des uploads depuis le navigateur.
// Idempotent : relancer ce bouton ne retraite que ce qui reste externe.
export async function migrateExternalProductImages(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature attendue par useActionState
  _prevState: MigrationState,
): Promise<MigrationState> {
  const supabase = await createClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const { data: images, error } = await supabase
    .from("product_images")
    .select("id, product_id, url");

  if (error) {
    return { message: null, error: `Erreur de lecture : ${error.message}` };
  }

  const external = (images ?? []).filter(
    (image) => supabaseUrl && !image.url.startsWith(supabaseUrl),
  );

  if (external.length === 0) {
    return {
      message: "Aucune image externe trouvée, tout est déjà dans la Médiathèque.",
      error: null,
    };
  }

  let migrated = 0;
  let failed = 0;

  for (const image of external) {
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

      if (image.product_id) {
        await supabase.from("media").insert({
          filename,
          path,
          url: publicUrlData.publicUrl,
          mime_type: contentType,
          kind: kindFromContentType(contentType),
          product_id: image.product_id,
        });
      }

      migrated += 1;
    } catch {
      failed += 1;
    }
  }

  revalidatePath("/admin/media");
  revalidatePath("/admin/products");
  revalidatePath("/boutique");
  revalidatePath("/", "layout");

  return {
    message: `${migrated} image(s) migrée(s) vers la Médiathèque${
      failed > 0 ? `, ${failed} échec(s) (lien externe inaccessible)` : ""
    }.`,
    error: null,
  };
}
