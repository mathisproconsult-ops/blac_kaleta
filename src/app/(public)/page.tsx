import { createClient } from "@/lib/supabase/server";
import { getSocialPlatform } from "@/lib/social-platforms";
import { ScrollingWorksBanner } from "./scrolling-works-banner";

const DEFAULT_WELCOME_TEXT =
  "Bienvenue dans mon univers. Ici, chaque trait, chaque image, chaque couleur porte un morceau de moi.";

type SocialLink = { id: number; platform: string; url: string };

async function getSocialLinks() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_links")
    .select("id, platform, url")
    .order("position", { ascending: true })
    .returns<SocialLink[]>();

  if (error) console.error("getSocialLinks", error);
  return data ?? [];
}

type FeaturedWork = {
  id: number;
  title: string;
  product_images: { id: number; url: string; position: number }[];
};

async function getFeaturedWorks() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, title, product_images(id, url, position)")
    .eq("featured_home", true)
    .eq("is_visible", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .returns<FeaturedWork[]>();

  return data ?? [];
}

// Requête séparée et best-effort : les colonnes peuvent ne pas encore
// exister si la migration 0040 n'a pas été appliquée — dans ce cas, la
// bannière retombe simplement sur un rendu sans dimensions réservées
// (comme avant), plutôt que de faire échouer toute la page d'accueil.
async function getImageDimensions(imageIds: number[]) {
  if (imageIds.length === 0) return new Map<number, { width: number | null; height: number | null }>();
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_images")
    .select("id, width, height")
    .in("id", imageIds);
  return new Map(
    (data ?? []).map((row) => [row.id, { width: row.width, height: row.height }]),
  );
}

// Requête séparée et best-effort : la colonne peut ne pas encore exister si
// la migration 0033 n'a pas été appliquée — la page d'accueil doit quand
// même s'afficher, avec la phrase par défaut.
async function getHomeWelcomeText() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("home_welcome_text")
    .eq("id", true)
    .maybeSingle();
  return (data as { home_welcome_text: string | null } | null)?.home_welcome_text || DEFAULT_WELCOME_TEXT;
}

export default async function HomePage() {
  const [featuredWorks, socialLinks, welcomeText] = await Promise.all([
    getFeaturedWorks(),
    getSocialLinks(),
    getHomeWelcomeText(),
  ]);

  const imageIds = featuredWorks.flatMap((work) => work.product_images.map((image) => image.id));
  const dimensionsById = await getImageDimensions(imageIds);

  const bannerWorks = featuredWorks.map((work) => {
    const image = [...work.product_images].sort((a, b) => a.position - b.position)[0];
    const dimensions = image ? dimensionsById.get(image.id) : undefined;
    return {
      id: work.id,
      title: work.title,
      image: image?.url ?? null,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    };
  });

  return (
    <div className="flex flex-col items-center gap-8 py-10 sm:py-16">
      {welcomeText ? (
        <p className="max-w-xl px-4 text-center text-sm leading-relaxed text-zinc-600 sm:px-6 sm:text-base dark:text-zinc-400">
          {welcomeText}
        </p>
      ) : null}
      {bannerWorks.length > 0 ? (
        <ScrollingWorksBanner works={bannerWorks} />
      ) : (
        <div
          className="mx-4 flex h-[320px] w-full max-w-[560px] items-center justify-center text-xs uppercase tracking-widest text-zinc-400 sm:mx-6 sm:h-[420px] lg:h-[520px]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #f0f0ee 0, #f0f0ee 2px, #ffffff 2px, #ffffff 12px)",
          }}
        >
          Œuvre vedette
        </div>
      )}
      {socialLinks.length > 0 ? (
        <div className="flex items-center gap-4 px-4 sm:px-6">
          {socialLinks.map((link) => {
            const platform = getSocialPlatform(link.platform);
            if (!platform) return null;
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={platform.label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 hover:border-zinc-400 hover:text-black dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
              >
                <platform.Icon size={18} />
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
