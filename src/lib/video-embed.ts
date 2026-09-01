// Parsing partagé entre l'admin (identification du lien collé par l'artiste)
// et le site public (construction de l'URL d'intégration pour la lightbox).
// YouTube/Vimeo/Instagram/TikTok exposent tous une vignette accessible sans
// authentification pour du contenu public (oEmbed pour Vimeo/Instagram/
// TikTok, schéma d'URL stable pour YouTube).

export type VideoProvider = "youtube" | "vimeo" | "instagram" | "tiktok";

// `id` peut être vide pour TikTok quand le lien collé est un lien court
// (vm.tiktok.com, vt.tiktok.com, tiktok.com/t/...) : l'ID réel n'est alors
// connu qu'après résolution côté serveur via l'oEmbed (voir actions.ts).
export type VideoRef = { provider: VideoProvider; id: string };

export function parseVideoUrl(url: string): VideoRef | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");

  if (host === "youtube.com") {
    const id = parsed.searchParams.get("v");
    if (id) return { provider: "youtube", id };
    const match = parsed.pathname.match(/^\/(embed|shorts)\/([\w-]+)/);
    if (match) return { provider: "youtube", id: match[2] };
    return null;
  }
  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1).split("/")[0];
    return id ? { provider: "youtube", id } : null;
  }
  if (host === "vimeo.com") {
    const match = parsed.pathname.match(/^\/(\d+)/);
    return match ? { provider: "vimeo", id: match[1] } : null;
  }
  if (host === "instagram.com") {
    const match = parsed.pathname.match(/^\/(?:p|reel|reels|tv)\/([\w-]+)/);
    return match ? { provider: "instagram", id: match[1] } : null;
  }
  if (host === "tiktok.com") {
    const match = parsed.pathname.match(/\/video\/(\d+)/);
    if (match) return { provider: "tiktok", id: match[1] };
    // Lien court du type tiktok.com/t/XXXXXXXXX : ID à résoudre via oEmbed.
    if (/^\/t\//.test(parsed.pathname)) return { provider: "tiktok", id: "" };
    return null;
  }
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") {
    return { provider: "tiktok", id: "" };
  }
  return null;
}

export function embedUrl(video: VideoRef): string {
  switch (video.provider) {
    case "youtube":
      return `https://www.youtube.com/embed/${video.id}?autoplay=1`;
    case "vimeo":
      return `https://player.vimeo.com/video/${video.id}?autoplay=1`;
    case "instagram":
      return `https://www.instagram.com/p/${video.id}/embed`;
    case "tiktok":
      return `https://www.tiktok.com/embed/v2/${video.id}`;
  }
}
