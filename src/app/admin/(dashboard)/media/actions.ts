"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function kindFromMime(mimeType: string): "image" | "gif" | "pdf" | "other" {
  if (mimeType === "image/gif") return "gif";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  return "other";
}

type UploadedFile = { path: string; url: string; filename: string; mimeType: string };

function parseUploadedFiles(formData: FormData): UploadedFile[] {
  const raw = formData.get("uploadedFiles");
  if (typeof raw !== "string" || !raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is UploadedFile =>
        typeof item?.path === "string" &&
        typeof item?.url === "string" &&
        typeof item?.filename === "string" &&
        typeof item?.mimeType === "string",
    );
  } catch {
    return [];
  }
}

// Les fichiers sont envoyés directement du navigateur vers Supabase Storage
// (MediaUploadField), pour ne pas faire transiter le fichier par le corps
// de la Server Action — limité côté plateforme d'hébergement. Cette action
// se contente d'enregistrer les métadonnées des fichiers déjà en ligne.
export async function attachUploadedMedia(formData: FormData) {
  const files = parseUploadedFiles(formData);
  if (files.length === 0) return;

  const supabase = await createClient();

  for (const file of files) {
    await supabase.from("media").insert({
      filename: file.filename,
      path: file.path,
      url: file.url,
      mime_type: file.mimeType,
      kind: kindFromMime(file.mimeType),
    });
  }

  revalidatePath("/admin/media");
  revalidatePath("/admin/products");
}

export async function deleteMedia(id: number, path: string) {
  const supabase = await createClient();
  await supabase.storage.from("media").remove([path]);
  await supabase.from("media").delete().eq("id", id);

  revalidatePath("/admin/media");
  revalidatePath("/admin/products");
}

export async function toggleMediaRecentWorks(
  productId: number,
  currentValue: boolean,
) {
  const supabase = await createClient();
  await supabase
    .from("products")
    .update({ show_in_recent_works: !currentValue })
    .eq("id", productId);

  revalidatePath("/admin/media");
  revalidatePath("/admin/products");
  revalidatePath("/oeuvres-recentes");
}
