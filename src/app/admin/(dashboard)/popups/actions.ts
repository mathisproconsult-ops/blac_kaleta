"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { optimizeAndStoreDecorImage } from "@/lib/artwork-storage";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function revalidatePublic() {
  revalidatePath("/", "layout");
  updateTag("popups");
}

function parsePopupFields(formData: FormData) {
  const title = formData.get("title");
  const body = formData.get("body");
  const buttonText = formData.get("button_text");
  const buttonUrl = formData.get("button_url");
  const scope = formData.get("scope");
  const scopePagePath = formData.get("scope_page_path");
  const frequency = formData.get("frequency");

  if (typeof title !== "string" || !title.trim()) return null;
  if (typeof body !== "string" || !body.trim()) return null;
  if (scope !== "all" && scope !== "home" && scope !== "page") return null;
  if (frequency !== "once" && frequency !== "every_session") return null;

  return {
    title: title.trim(),
    body: body.trim(),
    button_text: typeof buttonText === "string" && buttonText.trim() ? buttonText.trim() : null,
    button_url: typeof buttonUrl === "string" && buttonUrl.trim() ? buttonUrl.trim() : null,
    scope,
    scope_page_path:
      scope === "page" && typeof scopePagePath === "string" && scopePagePath.trim()
        ? scopePagePath.trim()
        : null,
    frequency,
    is_active: formData.get("is_active") === "on",
  };
}

async function uploadPopupImage(supabase: SupabaseClient, popupId: number, file: File) {
  return optimizeAndStoreDecorImage(supabase, "pages", `popups/${popupId}`, file);
}

export async function createPopup(formData: FormData) {
  const fields = parsePopupFields(formData);
  if (!fields) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("popups")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: popup, error } = await supabase
    .from("popups")
    .insert({ ...fields, position: (last?.position ?? -1) + 1 })
    .select("id")
    .single();

  if (error || !popup) {
    console.error("createPopup", error);
    return;
  }

  const imageFile = formData.get("image_file");
  const mediaId = formData.get("mediaId");

  if (imageFile instanceof File && imageFile.size > 0) {
    const uploaded = await uploadPopupImage(supabase, popup.id, imageFile);
    if (uploaded) {
      await supabase
        .from("popups")
        .update({ image_path: uploaded.path, image_url: uploaded.url })
        .eq("id", popup.id);
    }
  } else if (typeof mediaId === "string" && mediaId) {
    await applyMediaLibraryImage(supabase, popup.id, mediaId);
  }

  revalidatePath("/admin/popups");
  revalidatePublic();
}

// Réutilise une image déjà présente dans la Médiathèque plutôt que d'en
// uploader une nouvelle — même logique que pour les couvertures de
// catégories (categories/actions.ts).
async function applyMediaLibraryImage(supabase: SupabaseClient, popupId: number, mediaId: string) {
  const { data: media } = await supabase
    .from("media")
    .select("url, path")
    .eq("id", Number(mediaId))
    .maybeSingle();

  if (!media) return;

  await supabase
    .from("popups")
    .update({ image_path: media.path, image_url: media.url })
    .eq("id", popupId);
}

export async function updatePopup(id: number, formData: FormData) {
  const fields = parsePopupFields(formData);
  if (!fields) return;

  const supabase = await createClient();
  const updates: Record<string, unknown> = { ...fields };

  const removeImage = formData.get("remove_image") === "on";
  const imageFile = formData.get("image_file");
  const mediaId = formData.get("mediaId");

  // L'image d'une popup peut maintenant provenir de la Médiathèque
  // (bucket "media", partagé avec d'autres contenus) ou d'un envoi direct
  // (bucket "pages") : impossible de savoir sans ambiguïté à quel bucket
  // appartient l'ancienne image, donc on ne supprime plus jamais le fichier
  // en remplaçant/retirant — seule la référence sur la popup change. Même
  // choix déjà fait pour les couvertures de catégories (categories/actions.ts).
  if (imageFile instanceof File && imageFile.size > 0) {
    const uploaded = await uploadPopupImage(supabase, id, imageFile);
    if (uploaded) {
      updates.image_path = uploaded.path;
      updates.image_url = uploaded.url;
    }
  } else if (removeImage) {
    updates.image_path = null;
    updates.image_url = null;
  }

  const { error } = await supabase.from("popups").update(updates).eq("id", id);
  if (error) console.error("updatePopup", error);

  if (!(imageFile instanceof File && imageFile.size > 0) && typeof mediaId === "string" && mediaId) {
    await applyMediaLibraryImage(supabase, id, mediaId);
  }

  revalidatePath("/admin/popups");
  revalidatePublic();
}

export async function togglePopupActive(id: number, currentlyActive: boolean) {
  const supabase = await createClient();
  await supabase.from("popups").update({ is_active: !currentlyActive }).eq("id", id);
  revalidatePath("/admin/popups");
  revalidatePublic();
}

export async function deletePopup(id: number) {
  const supabase = await createClient();

  // Pas de suppression du fichier image : elle peut provenir de la
  // Médiathèque et être utilisée ailleurs (voir le même choix dans
  // updatePopup ci-dessus).
  await supabase.from("popups").delete().eq("id", id);
  revalidatePath("/admin/popups");
  revalidatePublic();
}

export async function movePopup(id: number, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: popups } = await supabase
    .from("popups")
    .select("id, position")
    .order("position", { ascending: true });

  if (!popups) return;

  const index = popups.findIndex((popup) => popup.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= popups.length) return;

  const current = popups[index];
  const target = popups[targetIndex];

  await supabase.from("popups").update({ position: target.position }).eq("id", current.id);
  await supabase.from("popups").update({ position: current.position }).eq("id", target.id);

  revalidatePath("/admin/popups");
  revalidatePublic();
}
