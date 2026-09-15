"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  blurStoredImage,
  createBlurredArtworkPreview,
  protectAndStoreArtworkImage,
} from "@/lib/artwork-storage";
import { parseVideoUrl, type VideoRef } from "@/lib/video-embed";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type RecentWorkFormState = { success: boolean; error: string | null };

// Requête séparée et best-effort : la colonne age_restricted peut ne pas
// encore exister si la migration 0034 n'a pas été appliquée — dans ce cas,
// aucune catégorie n'est traitée comme sensible plutôt que de faire
// échouer tout ajout de contenu.
async function isCategoryAgeRestricted(supabase: SupabaseClient, categoryId: number) {
  const { data } = await supabase
    .from("recent_work_categories")
    .select("age_restricted")
    .eq("id", categoryId)
    .maybeSingle();
  return (data as { age_restricted: boolean } | null)?.age_restricted ?? false;
}

// Mise à jour décorrélée de l'insertion principale : si la migration
// n'est pas encore appliquée, les colonnes image_blurred_*/age_restricted
// n'existent pas encore et cette étape best-effort échoue silencieusement
// plutôt que de faire échouer l'ajout de la photo/vidéo elle-même. Un aperçu
// flouté qui échoue à se générer (fichier illisible, lien externe temporai-
// rement injoignable...) ne bloque pas non plus l'ajout : l'élément reste
// affiché derrière un cadenas générique côté public plutôt que via l'image
// nette — jamais l'inverse, voir categorie/[id]/page.tsx.
async function applyBlurredFields(
  supabase: SupabaseClient,
  mediaId: number,
  ageRestricted: boolean,
  blurred: { path: string; url: string } | null,
) {
  const { error } = await supabase
    .from("recent_work_media")
    .update({
      age_restricted: ageRestricted,
      image_blurred_path: blurred?.path ?? null,
      image_blurred_url: blurred?.url ?? null,
    })
    .eq("id", mediaId);
  if (error) console.error("applyBlurredFields", error);
}

function parseCommonFields(formData: FormData) {
  const title = formData.get("title");
  const year = formData.get("year");
  const techniqueId = formData.get("technique_id");

  if (typeof title !== "string" || !title.trim()) return null;

  return {
    title: title.trim(),
    year: typeof year === "string" && year ? Number(year) : null,
    technique_id: typeof techniqueId === "string" && techniqueId ? Number(techniqueId) : null,
    ageRestricted: formData.get("age_restricted") === "on",
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

  const shouldBlur = fields.ageRestricted || (await isCategoryAgeRestricted(supabase, categoryId));
  let blurred: { path: string; url: string } | null = null;
  if (shouldBlur) {
    const { data: downloaded } = await supabase.storage.from("media").download(uploadedImage.path);
    blurred = downloaded
      ? await createBlurredArtworkPreview(
          supabase,
          `recent-works/${categoryId}`,
          Buffer.from(await downloaded.arrayBuffer()),
        )
      : null;
  }

  const { data: inserted, error } = await supabase
    .from("recent_work_media")
    .insert({
      recent_work_category_id: categoryId,
      kind: "photo",
      title: fields.title,
      year: fields.year,
      technique_id: fields.technique_id,
      image_path: stored?.path ?? uploadedImage.path,
      image_url: stored?.url ?? uploadedImage.url,
      position: await nextPosition(supabase, categoryId),
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("createRecentWorkPhoto", error);
    return { success: false, error: "Erreur base de données : " + error?.message };
  }

  await applyBlurredFields(supabase, inserted.id, fields.ageRestricted, blurred);

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

  const shouldBlur = fields.ageRestricted || (await isCategoryAgeRestricted(supabase, categoryId));
  let blurred: { path: string; url: string } | null = null;
  if (shouldBlur) {
    const { data: downloaded } = await supabase.storage
      .from("media")
      .download(uploadedVideo.thumbnailPath);
    blurred = downloaded
      ? await createBlurredArtworkPreview(
          supabase,
          `recent-works/${categoryId}`,
          Buffer.from(await downloaded.arrayBuffer()),
        )
      : null;
  }

  const { data: inserted, error } = await supabase
    .from("recent_work_media")
    .insert({
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
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("createRecentWorkVideoUpload", error);
    return { success: false, error: "Erreur base de données : " + error?.message };
  }

  await applyBlurredFields(supabase, inserted.id, fields.ageRestricted, blurred);

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

  const shouldBlur = fields.ageRestricted || (await isCategoryAgeRestricted(supabase, categoryId));
  let blurred: { path: string; url: string } | null = null;
  if (shouldBlur) {
    try {
      const response = await fetch(metadata.thumbnailUrl);
      const sourceBuffer = response.ok ? Buffer.from(await response.arrayBuffer()) : null;
      blurred = sourceBuffer
        ? await createBlurredArtworkPreview(supabase, `recent-works/${categoryId}`, sourceBuffer)
        : null;
    } catch (err) {
      console.error("createRecentWorkVideoLink fetch thumbnail", err);
      blurred = null;
    }
  }

  const { data: inserted, error } = await supabase
    .from("recent_work_media")
    .insert({
      recent_work_category_id: categoryId,
      kind: "video",
      title: fields.title,
      year: fields.year,
      technique_id: fields.technique_id,
      video_provider: video.provider,
      video_external_url: storedExternalUrl,
      image_url: metadata.thumbnailUrl,
      position: await nextPosition(supabase, categoryId),
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("createRecentWorkVideoLink", error);
    return { success: false, error: "Erreur base de données : " + error?.message };
  }

  await applyBlurredFields(supabase, inserted.id, fields.ageRestricted, blurred);

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

  // Requête séparée et best-effort : la colonne peut ne pas encore exister
  // si la migration 0034 n'a pas été appliquée.
  const { data: blurredRow } = await supabase
    .from("recent_work_media")
    .select("image_blurred_path")
    .eq("id", id)
    .maybeSingle();
  const blurredPath = (blurredRow as { image_blurred_path: string | null } | null)?.image_blurred_path;
  if (blurredPath) {
    await supabase.storage.from("products").remove([blurredPath]);
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

// Bascule le marquage +18 d'une entrée déjà existante. À l'activation, la
// vignette floutée est (re)générée à partir de l'image déjà en place
// (image_path pour une photo/vignette vidéo uploadée, image_url pour une
// vignette externe YouTube/Vimeo/Instagram/TikTok) — pas besoin de
// ré-uploader quoi que ce soit.
export async function toggleRecentWorkMediaAgeRestricted(
  id: number,
  categoryId: number,
  formData: FormData,
) {
  const ageRestricted = formData.get("age_restricted") === "on";
  const supabase = await createClient();

  let blurred: { path: string; url: string } | null = null;
  if (ageRestricted) {
    const { data: row } = await supabase
      .from("recent_work_media")
      .select("image_path, image_url, image_blurred_path")
      .eq("id", id)
      .maybeSingle();

    if ((row as { image_blurred_path?: string | null } | null)?.image_blurred_path) {
      // Déjà généré précédemment (ex : catégorie déjà sensible) — rien à refaire.
      blurred = null;
    } else if (row?.image_path) {
      blurred = await blurStoredImage(supabase, `recent-works/${categoryId}`, "products", row.image_path);
    } else if (row?.image_url) {
      try {
        const response = await fetch(row.image_url);
        const sourceBuffer = response.ok ? Buffer.from(await response.arrayBuffer()) : null;
        blurred = sourceBuffer
          ? await createBlurredArtworkPreview(supabase, `recent-works/${categoryId}`, sourceBuffer)
          : null;
      } catch (err) {
        console.error("toggleRecentWorkMediaAgeRestricted fetch thumbnail", err);
      }
    }
  }

  const updates: Record<string, unknown> = { age_restricted: ageRestricted };
  if (blurred) {
    updates.image_blurred_path = blurred.path;
    updates.image_blurred_url = blurred.url;
  }

  const { error } = await supabase.from("recent_work_media").update(updates).eq("id", id);
  if (error) console.error("toggleRecentWorkMediaAgeRestricted", error);

  revalidatePath(`/admin/oeuvres-recentes/${categoryId}`);
  revalidatePath("/oeuvres-recentes");
}
