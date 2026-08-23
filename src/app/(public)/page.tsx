import { createClient } from "@/lib/supabase/server";
import { getSocialPlatform } from "@/lib/social-platforms";
import { ScrollingWorksBanner } from "./scrolling-works-banner";

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
  product_images: { url: string; position: number }[];
};

async function getFeaturedWorks() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, title, product_images(url, position)")
    .eq("featured_home", true)
    .eq("is_visible", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .returns<FeaturedWork[]>();

  return data ?? [];
}

export default async function HomePage() {
  const [featuredWorks, socialLinks] = await Promise.all([
    getFeaturedWorks(),
    getSocialLinks(),
  ]);

  const bannerWorks = featuredWorks.map((work) => {
    const image = [...work.product_images].sort((a, b) => a.position - b.position)[0];
    return { id: work.id, title: work.title, image: image?.url ?? null };
  });

  return (
    <div className="flex flex-col items-center gap-8 py-10 sm:py-16">
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
