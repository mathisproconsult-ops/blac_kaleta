import Link from "next/link";
import {
  SiFacebook,
  SiInstagram,
  SiPatreon,
  SiTiktok,
  SiWhatsapp,
  SiYoutube,
} from "react-icons/si";
import { getSettings, type Settings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

const SOCIAL_ICONS: {
  key: keyof Settings;
  label: string;
  Icon: typeof SiInstagram;
}[] = [
  { key: "social_instagram", label: "Instagram", Icon: SiInstagram },
  { key: "social_facebook", label: "Facebook", Icon: SiFacebook },
  { key: "social_whatsapp", label: "WhatsApp", Icon: SiWhatsapp },
  { key: "social_youtube", label: "YouTube", Icon: SiYoutube },
  { key: "social_tiktok", label: "TikTok", Icon: SiTiktok },
  { key: "social_patreon", label: "Patreon", Icon: SiPatreon },
];

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
    .order("created_at", { ascending: false })
    .returns<FeaturedWork[]>();

  return data ?? [];
}

export default async function HomePage() {
  const [settings, featuredWorks] = await Promise.all([
    getSettings(),
    getFeaturedWorks(),
  ]);

  const socialLinks = SOCIAL_ICONS.filter(({ key }) => settings[key]);

  return (
    <div className="flex flex-col items-center gap-8 px-6 py-16">
      {featuredWorks.length > 0 ? (
        <div className="flex w-full max-w-3xl flex-wrap justify-center gap-6">
          {featuredWorks.map((work) => {
            const image = [...work.product_images].sort(
              (a, b) => a.position - b.position,
            )[0];

            return (
              <Link
                key={work.id}
                href={`/boutique/${work.id}`}
                className="aspect-square w-full max-w-[560px] flex-1"
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image.url}
                    alt={work.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-xs uppercase tracking-widest text-zinc-400"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(45deg, #f0f0ee 0, #f0f0ee 2px, #ffffff 2px, #ffffff 12px)",
                    }}
                  >
                    {work.title}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <div
          className="flex aspect-square w-full max-w-[560px] items-center justify-center text-xs uppercase tracking-widest text-zinc-400"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #f0f0ee 0, #f0f0ee 2px, #ffffff 2px, #ffffff 12px)",
          }}
        >
          Œuvre vedette
        </div>
      )}
      {socialLinks.length > 0 ? (
        <div className="flex items-center gap-4">
          {socialLinks.map(({ key, label, Icon }) => (
            <a
              key={key}
              href={settings[key] as string}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 hover:border-zinc-400 hover:text-black"
            >
              <Icon size={18} />
            </a>
          ))}
        </div>
      ) : null}
      <a
        href={`mailto:${settings.contact_email}`}
        className="text-sm text-zinc-600 hover:underline"
      >
        {settings.contact_email}
      </a>
    </div>
  );
}
