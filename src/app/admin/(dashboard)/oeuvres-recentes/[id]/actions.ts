"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { protectAndStoreArtworkImage } from "@/lib/artwork-storage";
import { parseVideoUrl, type VideoRef } from "@/lib/video-embed";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type RecentWorkFormState = { success: boolean; error: string | null };

function parseCommonFields(formData: FormData) {
  const title = formData.get("title");
  const year = formData.get("year");
  const techniqueId = formData.get("technique_id");

  if (typeof title !== "string" || !title.trim()) return null;

  return {
    title: title.trim(),
    year: typeof year === "string" && year ? Number(year) : null,
    technique_id: typeof techniqueId === "string" && techniqueId ? Number(techniqueId) : null,
  };
}

async function nextPosition(supabase: SupabaseClient, categoryId: number) {
  const { data: last } = await supabase
    .from("recent_work_media")
    .select("position")
    .eq("recent_work_category_id", categoryId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (last?.position ?? -1) + 1;
}

type UploadedImage = { path: string; url: string; filename: string; mimeType: string };

function parseUploadedImage(formData: FormData): UploadedImage | null {
  const raw = formData.get("uploadedImage");
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.path === "string" &&
      typeof parsed?.url === "string" &&
      typeof parsed?.filename === "string" &&
      typeof parsed?.mimeType === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function createRecentWorkPhoto(
  categoryId: number,
  _prevState: RecentWorkFormState,
  formData: FormData,
): Promise<RecentWorkFormState> {
  const fields = parseCommonFields(formData);
  if (!fields) return { success: false, error: "Le titre est obligatoire." };

  const uploadedImage = parseUploadedImage(formData);
  if (!uploadedImage) return { success: false, error: "Ajoute une photo." };

  const supabase = await createClient();
  const stored = await protectAndStoreArtworkImage(
    supabase,
    `recent-works/${categoryId}`,
    uploadedImage.path,
    uploadedImage.mimeType,
  );

  const { error } = await supabase.from("recent_work_media").insert({
    recent_work_category_id: categoryId,
    kind: "photo",
    title: fields.title,
    year: fields.year,
    technique_id: fields.technique_id,
    image_path: stored?.path ?? uploadedImage.path,
    image_url: stored?.url ?? uploadedImage.url,
    position: await nextPosition(supabase, categoryId),
  });

  if (error) {
    console.error("createRecentWorkPhoto", error);
    return { success: false, error: "Erreur base de données : " + error.message };
  }

  revalidatePath(`/admin/oeuvres-recentes/${categoryId}`);
  revalidatePath("/oeuvres-recentes");
  return { success: true, error: null };
}

type UploadedVideo = {
  videoPath: string;
  videoUrl: string;
  thumbnailPath: string;
  thumbnailUrl: string;
};

function parseUploadedVideo(formData: FormData): UploadedVideo | null {
  const raw = formData.get("uploadedVideo");
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.videoPath === "string" &&
      typeof parsed?.videoUrl === "string" &&
      typeof parsed?.thumbnailPath === "string" &&
      typeof parsed?.thumbnailUrl === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function createRecentWorkVideoUpload(
  categoryId: number,
  _prevState: RecentWorkFormState,
  formData: FormData,
): Promise<RecentWorkFormState> {
  const fields = parseCommonFields(formData);
  if (!fields) return { success: false, error: "Le titre est obligatoire." };

  const uploadedVideo = parseUploadedVideo(formData);
  if (!uploadedVideo) return { success: false, error: "Ajoute un fichier vidéo." };

  const supabase = await createClient();
  const { error } = await supabase.from("recent_work_media").insert({
    recent_work_category_id: categoryId,
    kind: "video",
    title: fields.title,
    year: fields.year,
    technique_id: fields.technique_id,
    video_path: uploadedVideo.videoPath,
    video_url: uploadedVideo.videoUrl,
    image_path: uploadedVideo.thumbnailPath,
    image_url: uploadedVideo.thumbnailUrl,
    position: await nextPosition(supabase, categoryId),
  });

  if (error) {
    console.error("createRecentWorkVideoUpload", error);
    return { success: false, error: "Erreur base de données : " + error.message };
  }

  revalidatePath(`/admin/oeuvres-recentes/${categoryId}`);
  revalidatePath("/oeuvres-recentes");
  return { success: true, error: null };
}

type VideoMetadata = { thumbnailUrl: string; id: string };

// Résout la vignette d'un lien vidéo externe, et pour TikTok (quand le lien
// collé est un lien court sans ID dans l'URL) l'ID réel de la vidéo — tiré
// de l'attribut data-video-id renvoyé dans le HTML d'intégration de
// l'oEmbed. Ne fonctionne que pour du contenu public : un post privé ou
// supprimé renvoie une erreur HTTP côté plateforme, remontée ici comme un
// échec (null) plutôt qu'une exception.
async function fetchVideoMetadata(video: VideoRef, externalUrl: string): Promise<VideoMetadata | null> {
  if (video.provider === "youtube") {
    return { thumbnailUrl: `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`, id: video.id };
  }

  if (video.provider === "vimeo") {
    try {
      const response = await fetch(
        `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${video.id}`)}`,
      );
      if (!response.ok) return null;
      const data = (await response.json()) as { thumbnail_url?: string };
      return data.thumbnail_url ? { thumbnailUrl: data.thumbnail_url, id: video.id } : null;
    } catch (err) {
      console.error("fetchVideoMetadata vimeo", err);
      return null;
    }
  }

  if (video.provider === "instagram") {
    // Endpoint oEmbed public de Meta, sans jeton d'accès requis depuis
    // l'assouplissement de juin 2026 pour le contenu public (posts, reels).
    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/instagram_oembed?url=${encodeURIComponent(externalUrl)}&omitscript=true`,
      );
      if (!response.ok) return null;
      const data = (await response.json()) as { thumbnail_url?: string };
      return data.thumbnail_url ? { thumbnailUrl: data.thumbnail_url, id: video.id } : null;
    } catch (err) {
      console.error("fetchVideoMetadata instagram", err);
      return null;
    }
  }

  // TikTok
  try {
    const response = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(externalUrl)}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { thumbnail_url?: string; html?: string };
    let id = video.id;
    if (!id && typeof data.html === "string") {
      const match = data.html.match(/data-video-id="(\d+)"/);
      if (match) id = match[1];
    }
    if (!data.thumbnail_url || !id) return null;
    return { thumbnailUrl: data.thumbnail_url, id };
  } catch (err) {
    console.error("fetchVideoMetadata tiktok", err);
    return null;
  }
}

export async function createRecentWorkVideoLink(
  categoryId: number,
  _prevState: RecentWorkFormState,
  formData: FormData,
): Promise<RecentWorkFormState> {
  const fields = parseCommonFields(formData);
  if (!fields) return { success: false, error: "Le titre est obligatoire." };

  const externalUrl = formData.get("externalUrl");
  if (typeof externalUrl !== "string" || !externalUrl.trim()) {
    return { success: false, error: "Colle un lien YouTube, Vimeo, Instagram ou TikTok." };
  }
  const trimmedUrl = externalUrl.trim();

  const video = parseVideoUrl(trimmedUrl);
  if (!video) {
    return {
      success: false,
      error: "Lien non reconnu — colle un lien YouTube, Vimeo, Instagram ou TikTok valide.",
    };
  }

  const metadata = await fetchVideoMetadata(video, trimmedUrl);
  if (!metadata) {
    return {
      success: false,
      error:
        "Impossible de récupérer la vignette de ce lien — vérifie qu'il s'agit bien d'un post public (les comptes ou publications privés ne sont pas accessibles).",
    };
  }

  // Pour un lien court TikTok (vm./vt.tiktok.com), on enregistre l'URL
  // canonique avec l'ID résolu par l'oEmbed, pour que la page publique
  // puisse reconstruire l'intégration sans nouvel appel réseau à chaque
  // affichage.
  const storedExternalUrl =
    video.provider === "tiktok" && !video.id
      ? `https://www.tiktok.com/@i/video/${metadata.id}`
      : trimmedUrl;

  const supabase = await createClient();
  const { error } = await supabase.from("recent_work_media").insert({
    recent_work_category_id: categoryId,
    kind: "video",
    title: fields.title,
    year: fields.year,
    technique_id: fields.technique_id,
    video_provider: video.provider,
    video_external_url: storedExternalUrl,
    image_url: metadata.thumbnailUrl,
    position: await nextPosition(supabase, categoryId),
  });

  if (error) {
    console.error("createRecentWorkVideoLink", error);
    return { success: false, error: "Erreur base de données : " + error.message };
  }

  revalidatePath(`/admin/oeuvres-recentes/${categoryId}`);
  revalidatePath("/oeuvres-recentes");
  return { success: true, error: null };
}

export async function deleteRecentWorkMedia(id: number, categoryId: number) {
  const supabase = await createClient();

  const { data: entry } = await supabase
    .from("recent_work_media")
    .select("image_path, video_path")
    .eq("id", id)
    .maybeSingle();

  if (entry?.image_path) {
    await supabase.storage.from("products").remove([entry.image_path]);
  }
  if (entry?.video_path) {
    await supabase.storage.from("media").remove([entry.video_path]);
  }

  await supabase.from("recent_work_media").delete().eq("id", id);

  revalidatePath(`/admin/oeuvres-recentes/${categoryId}`);
  revalidatePath("/oeuvres-recentes");
}

export async function moveRecentWorkMedia(id: number, categoryId: number, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("recent_work_media")
    .select("id, position")
    .eq("recent_work_category_id", categoryId)
    .order("position", { ascending: true });

  if (!items) return;

  const index = items.findIndex((item) => item.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= items.length) return;

  const current = items[index];
  const target = items[targetIndex];

  await supabase.from("recent_work_media").update({ position: target.position }).eq("id", current.id);
  await supabase.from("recent_work_media").update({ position: current.position }).eq("id", target.id);

  revalidatePath(`/admin/oeuvres-recentes/${categoryId}`);
  revalidatePath("/oeuvres-recentes");
}
