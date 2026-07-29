import type { IconType } from "react-icons";
import {
  SiBehance,
  SiFacebook,
  SiInstagram,
  SiPatreon,
  SiPinterest,
  SiTiktok,
  SiWhatsapp,
  SiX,
  SiYoutube,
} from "react-icons/si";
import { FaLinkedin } from "react-icons/fa6";

export type SocialPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "whatsapp"
  | "patreon"
  | "x"
  | "pinterest"
  | "behance"
  | "linkedin";

export const SOCIAL_PLATFORMS: { key: SocialPlatform; label: string; Icon: IconType }[] = [
  { key: "instagram", label: "Instagram", Icon: SiInstagram },
  { key: "tiktok", label: "TikTok", Icon: SiTiktok },
  { key: "youtube", label: "YouTube", Icon: SiYoutube },
  { key: "facebook", label: "Facebook", Icon: SiFacebook },
  { key: "whatsapp", label: "WhatsApp", Icon: SiWhatsapp },
  { key: "patreon", label: "Patreon", Icon: SiPatreon },
  { key: "x", label: "X (Twitter)", Icon: SiX },
  { key: "pinterest", label: "Pinterest", Icon: SiPinterest },
  { key: "behance", label: "Behance", Icon: SiBehance },
  { key: "linkedin", label: "LinkedIn", Icon: FaLinkedin },
];

export function getSocialPlatform(key: string) {
  return SOCIAL_PLATFORMS.find((platform) => platform.key === key) ?? null;
}
