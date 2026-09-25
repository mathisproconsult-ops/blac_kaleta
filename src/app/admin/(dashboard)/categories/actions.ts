"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { optimizeAndStoreDecorImage } from "@/lib/artwork-storage";

export async function createCategory(formData: FormData) {
  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("categories")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (last?.position ?? -1) + 1;

  await supabase
    .from("categories")
    .insert({ name: name.trim(), position: nextPosition });

  revalidatePath("/admin/categories");
}

export async function renameCategory(id: number, formData: FormData) {
  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) return;

  const supabase = await createClient();
  await supabase.from("categories").update({ name: name.trim() }).eq("id", id);

  revalidatePath("/admin/categories");
}

export async function deleteCategory(id: number) {
  const supabase = await createClient();
  await supabase.from("categories").delete().eq("id", id);

  revalidatePath("/admin/categories");
}

export async function updateCategoryCover(id: number, formData: FormData) {
  const supabase = await createClient();
  const file = formData.get("cover_file");
  const mediaId = formData.get("mediaId");
  const removeCover = formData.get("remove_cover") === "on";

  if (file instanceof File && file.size > 0) {
    const uploaded = await optimizeAndStoreDecorImage(supabase, "media", `categories/${id}`, file);

    if (uploaded) {
      await supabase.from("media").insert({
        filename: file.name,
        path: uploaded.path,
        url: uploaded.url,
        mime_type: file.type === "image/gif" ? "image/gif" : "image/webp",
        kind: file.type === "image/gif" ? "gif" : "image",
      });

      await supabase
        .from("categories")
        .update({ cover_image_url: uploaded.url, cover_image_path: uploaded.path })
        .eq("id", id);
    }
  } else if (typeof mediaId === "string" && mediaId) {
    const { data: media } = await supabase
      .from("media")
      .select("url, path")
      .eq("id", Number(mediaId))
      .maybeSingle();

    if (media) {
      await supabase
        .from("categories")
        .update({ cover_image_url: media.url, cover_image_path: media.path })
        .eq("id", id);
    }
  } else if (removeCover) {
    await supabase
      .from("categories")
      .update({ cover_image_url: null, cover_image_path: null })
      .eq("id", id);
  }

  revalidatePath("/admin/categories");
  revalidatePath("/boutique");
}

export async function moveCategory(id: number, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, position")
    .order("position", { ascending: true });

  if (!categories) return;

  const index = categories.findIndex((category) => category.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= categories.length) return;

  const current = categories[index];
  const target = categories[targetIndex];

  await supabase
    .from("categories")
    .update({ position: target.position })
    .eq("id", current.id);
  await supabase
    .from("categories")
    .update({ position: current.position })
    .eq("id", target.id);

  revalidatePath("/admin/categories");
}
