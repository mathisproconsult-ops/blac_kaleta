// Parsing partagé entre l'admin (identification du lien collé par l'artiste)
// et le site public (construction de l'URL d'intégration pour la lightbox).
// Ni clé API ni authentification nécessaires : la vignette YouTube suit un
// schéma d'URL public et stable, Vimeo expose la sienne via son oEmbed public.

export type VideoRef = { provider: "youtube" | "vimeo"; id: string };

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
  return null;
}

export function embedUrl(video: VideoRef): string {
  return video.provider === "youtube"
    ? `https://www.youtube.com/embed/${video.id}?autoplay=1`
    : `https://player.vimeo.com/video/${video.id}?autoplay=1`;
}
