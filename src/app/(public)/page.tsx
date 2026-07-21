import { SiInstagram, SiTiktok, SiWhatsapp, SiYoutube } from "react-icons/si";
import { getSettings } from "@/lib/settings";
import { getPageBlocks } from "@/lib/page-blocks";
import { PageBlocks } from "@/components/page-blocks";

const socialLinks = [
  { label: "WhatsApp", href: "#", Icon: SiWhatsapp },
  { label: "Instagram", href: "#", Icon: SiInstagram },
  { label: "YouTube", href: "#", Icon: SiYoutube },
  { label: "TikTok", href: "#", Icon: SiTiktok },
];

export default async function HomePage() {
  const [{ contact_email: contactEmail }, blocks] = await Promise.all([
    getSettings(),
    getPageBlocks("home"),
  ]);

  return (
    <div className="flex flex-col items-center gap-8 px-6 py-16">
      <PageBlocks blocks={blocks} />
      <div className="flex items-center gap-4">
        {socialLinks.map(({ label, href, Icon }) => (
          <a
            key={label}
            href={href}
            aria-label={label}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 hover:border-zinc-400 hover:text-black"
          >
            <Icon size={18} />
          </a>
        ))}
      </div>
      <a href={`mailto:${contactEmail}`} className="text-sm text-zinc-600 hover:underline">
        {contactEmail}
      </a>
    </div>
  );
}
