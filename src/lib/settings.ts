import { createClient } from "@/lib/supabase/server";

export type Settings = {
  shop_name: string;
  contact_email: string;
  header_logo_url: string | null;
  footer_copyright_text: string;
  usd_rate: number;
};

const defaultSettings: Settings = {
  shop_name: "Blac_Kaleta",
  contact_email: "contact@blac-kaleta.com",
  header_logo_url: null,
  footer_copyright_text: "© Blac_Kaleta",
  usd_rate: 610,
};

export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("shop_name, contact_email, header_logo_url, footer_copyright_text, usd_rate")
    .eq("id", true)
    .maybeSingle();

  return (data as Settings | null) ?? defaultSettings;
}
