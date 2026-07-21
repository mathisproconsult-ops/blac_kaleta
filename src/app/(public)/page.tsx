import { SiInstagram, SiTiktok, SiWhatsapp, SiYoutube } from "react-icons/si";
import { getSettings } from "@/lib/settings";

const socialLinks = [
  { label: "WhatsApp", href: "#", Icon: SiWhatsapp },
  { label: "Instagram", href: "#", Icon: SiInstagram },
  { label: "YouTube", href: "#", Icon: SiYoutube },
  { label: "TikTok", href: "#", Icon: SiTiktok },
];

export default async function HomePage() {
  const { contact_email: contactEmail } = await getSettings();

  return (
    <div className="flex flex-col items-center gap-8 px-6 py-16">
      <div
        className="flex aspect-square w-full max-w-[560px] items-center justify-center text-xs uppercase tracking-widest text-zinc-400"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #f0f0ee 0, #f0f0ee 2px, #ffffff 2px, #ffffff 12px)",
        }}
      >
        Œuvre vedette
      </div>
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
