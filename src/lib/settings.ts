import { createClient } from "@/lib/supabase/server";

export type Settings = {
  shop_name: string;
  contact_email: string;
  header_logo_url: string | null;
  footer_copyright_text: string;
  social_instagram: string | null;
  social_facebook: string | null;
  social_whatsapp: string | null;
  social_youtube: string | null;
  social_tiktok: string | null;
  social_patreon: string | null;
};

const defaultSettings: Settings = {
  shop_name: "Blac_Kaleta",
  contact_email: "contact@blac-kaleta.com",
  header_logo_url: null,
  footer_copyright_text: "© Blac_Kaleta",
  social_instagram: null,
  social_facebook: null,
  social_whatsapp: null,
  social_youtube: null,
  social_tiktok: null,
  social_patreon: null,
};

export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select(
      "shop_name, contact_email, header_logo_url, footer_copyright_text, social_instagram, social_facebook, social_whatsapp, social_youtube, social_tiktok, social_patreon",
    )
    .eq("id", true)
    .maybeSingle();

  return (data as Settings | null) ?? defaultSettings;
}
