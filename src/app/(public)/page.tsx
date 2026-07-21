import {
  SiFacebook,
  SiInstagram,
  SiPatreon,
  SiTiktok,
  SiWhatsapp,
  SiYoutube,
} from "react-icons/si";
import { getSettings, type Settings } from "@/lib/settings";
import { getPageBlocks } from "@/lib/page-blocks";
import { PageBlocks } from "@/components/page-blocks";

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

export default async function HomePage() {
  const [settings, blocks] = await Promise.all([
    getSettings(),
    getPageBlocks("home"),
  ]);

  const socialLinks = SOCIAL_ICONS.filter(({ key }) => settings[key]);

  return (
    <div className="flex flex-col items-center gap-8 px-6 py-16">
      <PageBlocks blocks={blocks} />
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
