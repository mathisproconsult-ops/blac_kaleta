"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function kindFromFile(file: File): "image" | "gif" | "pdf" | "other" {
  if (file.type === "image/gif") return "gif";
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  return "other";
}

export async function uploadMedia(formData: FormData) {
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) return;

  const supabase = await createClient();

  for (const file of files) {
    const path = `library/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(path, file, { contentType: file.type });

    if (uploadError) continue;

    const { data: publicUrlData } = supabase.storage
      .from("media")
      .getPublicUrl(path);

    await supabase.from("media").insert({
      filename: file.name,
      path,
      url: publicUrlData.publicUrl,
      mime_type: file.type,
      kind: kindFromFile(file),
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
