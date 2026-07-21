import { createClient } from "@/lib/supabase/server";

export type Settings = {
  shop_name: string;
  contact_email: string;
};

const defaultSettings: Settings = {
  shop_name: "Blac_Kaleta",
  contact_email: "contact@blac-kaleta.com",
};

export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("shop_name, contact_email")
    .eq("id", true)
    .maybeSingle();

  return (data as Settings | null) ?? defaultSettings;
}
