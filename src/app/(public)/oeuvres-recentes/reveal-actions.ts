"use server";

import { createClient } from "@/lib/supabase/server";
import { parseVideoUrl, embedUrl } from "@/lib/video-embed";

export type RevealedMedia = {
  imageUrl: string | null;
  videoUrl: string | null;
  videoEmbedUrl: string | null;
};

// Ne renvoie l'image/vidéo nette d'une œuvre +18 qu'une fois appelée
// explicitement par le client, après la vérification d'âge au clic —
// jamais incluse dans le rendu initial de la page (categorie/[id]/page.tsx),
// pour qu'une simple inspection du code source ne suffise pas à la
// récupérer. Comme le reste de cette barrière, ça relève de la bonne foi :
// quelqu'un qui inspecterait les requêtes réseau pourrait toujours appeler
// cette action directement — l'objectif est d'aller au-delà du simple flou
// CSS, pas de construire une protection infaillible.
export async function getRecentWorkFullMedia(workId: string): Promise<RevealedMedia | null> {
  const supabase = await createClient();

  if (workId.startsWith("product-")) {
    const productId = Number(workId.slice("product-".length));
    if (!Number.isInteger(productId)) return null;

    let { data } = await supabase
      .from("products")
      .select("product_images(url, position, high_quality_url)")
      .eq("id", productId)
      .maybeSingle();
    // high_quality_url peut ne pas encore exister (migration 0043) : retente
    // sans elle plutôt que de ne plus rien afficher dans la lightbox.
    if (!data) {
      const fallback = await supabase
        .from("products")
        .select("product_images(url, position)")
        .eq("id", productId)
        .maybeSingle();
      data = fallback.data as typeof data;
    }
    if (!data) return null;

    const images = (
      data as { product_images: { url: string; position: number; high_quality_url?: string | null }[] }
    ).product_images;
    const first = [...images].sort((a, b) => a.position - b.position)[0];
    // Haute résolution (Paramètres → Qualité des images) pour la lightbox,
    // repli sur la taille principale si absente (photo pas encore
    // retraitée depuis la migration 0043).
    const imageUrl = first ? (first.high_quality_url ?? first.url ?? null) : null;
    return { imageUrl, videoUrl: null, videoEmbedUrl: null };
  }

  if (workId.startsWith("media-")) {
    const mediaId = Number(workId.slice("media-".length));
    if (!Number.isInteger(mediaId)) return null;

    let { data } = await supabase
      .from("recent_work_media")
      .select("image_url, high_quality_url, video_url, video_provider, video_external_url")
      .eq("id", mediaId)
      .maybeSingle();
    // high_quality_url peut ne pas encore exister (migration 0043) : retente
    // sans elle plutôt que de ne plus rien afficher dans la lightbox.
    if (!data) {
      const fallback = await supabase
        .from("recent_work_media")
        .select("image_url, video_url, video_provider, video_external_url")
        .eq("id", mediaId)
        .maybeSingle();
      data = fallback.data as typeof data;
    }
    if (!data) return null;

    let videoEmbedUrl: string | null = null;
    if (data.video_provider && data.video_external_url) {
      const ref = parseVideoUrl(data.video_external_url);
      videoEmbedUrl = ref ? embedUrl(ref) : null;
    }

    return {
      imageUrl: data.high_quality_url ?? data.image_url,
      videoUrl: data.video_url,
      videoEmbedUrl,
    };
  }

  return null;
}
