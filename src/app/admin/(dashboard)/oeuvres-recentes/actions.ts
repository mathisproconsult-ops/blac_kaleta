"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createRecentWorkCategory(formData: FormData) {
  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("recent_work_categories")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (last?.position ?? -1) + 1;

  await supabase
    .from("recent_work_categories")
    .insert({ name: name.trim(), position: nextPosition });

  revalidatePath("/admin/oeuvres-recentes");
  revalidatePath("/oeuvres-recentes");
}

export async function renameRecentWorkCategory(id: number, formData: FormData) {
  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) return;

  const supabase = await createClient();
  await supabase.from("recent_work_categories").update({ name: name.trim() }).eq("id", id);

  revalidatePath("/admin/oeuvres-recentes");
  revalidatePath("/oeuvres-recentes");
}

export async function deleteRecentWorkCategory(id: number) {
  const supabase = await createClient();
  await supabase.from("recent_work_categories").delete().eq("id", id);

  revalidatePath("/admin/oeuvres-recentes");
  revalidatePath("/oeuvres-recentes");
}

export async function updateRecentWorkCategoryCover(id: number, formData: FormData) {
  const supabase = await createClient();
  const file = formData.get("cover_file");
  const mediaId = formData.get("mediaId");
  const removeCover = formData.get("remove_cover") === "on";

  if (file instanceof File && file.size > 0) {
    const path = `recent-work-categories/${id}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(path, file, { contentType: file.type });

    if (!uploadError) {
      const { data: publicUrlData } = supabase.storage.from("media").getPublicUrl(path);

      await supabase.from("media").insert({
        filename: file.name,
        path,
        url: publicUrlData.publicUrl,
        mime_type: file.type,
        kind: file.type === "image/gif" ? "gif" : "image",
      });

      await supabase
        .from("recent_work_categories")
        .update({ cover_image_url: publicUrlData.publicUrl, cover_image_path: path })
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
        .from("recent_work_categories")
        .update({ cover_image_url: media.url, cover_image_path: media.path })
        .eq("id", id);
    }
  } else if (removeCover) {
    await supabase
      .from("recent_work_categories")
      .update({ cover_image_url: null, cover_image_path: null })
      .eq("id", id);
  }

  revalidatePath("/admin/oeuvres-recentes");
  revalidatePath("/oeuvres-recentes");
}

export async function moveRecentWorkCategory(id: number, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("recent_work_categories")
    .select("id, position")
    .order("position", { ascending: true });

  if (!categories) return;

  const index = categories.findIndex((category) => category.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= categories.length) return;

  const current = categories[index];
  const target = categories[targetIndex];

  await supabase
    .from("recent_work_categories")
    .update({ position: target.position })
    .eq("id", current.id);
  await supabase
    .from("recent_work_categories")
    .update({ position: current.position })
    .eq("id", target.id);

  revalidatePath("/admin/oeuvres-recentes");
  revalidatePath("/oeuvres-recentes");
}
