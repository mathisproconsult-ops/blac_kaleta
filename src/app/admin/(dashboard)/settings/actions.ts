"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Mise à jour du logo isolée du reste des champs : si un champ non lié
// (ex: usd_rate) échoue à l'enregistrement à cause d'une colonne pas encore
// migrée côté base, le logo doit quand même être sauvegardé.
async function updateLogo(supabase: SupabaseClient, formData: FormData) {
  const logoFile = formData.get("logo");
  const removeLogo = formData.get("remove_logo") === "on";

  if (logoFile instanceof File && logoFile.size > 0) {
    const { data: current } = await supabase
      .from("settings")
      .select("header_logo_path")
      .eq("id", true)
      .maybeSingle();

    const path = `branding/${crypto.randomUUID()}-${logoFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from("pages")
      .upload(path, logoFile, { contentType: logoFile.type });

    if (uploadError) {
      console.error("updateLogo upload", uploadError);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("pages")
      .getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("settings")
      .update({ header_logo_url: publicUrlData.publicUrl, header_logo_path: path })
      .eq("id", true);

    if (updateError) {
      console.error("updateLogo db", updateError);
      return;
    }

    if (current?.header_logo_path) {
      await supabase.storage.from("pages").remove([current.header_logo_path]);
    }
  } else if (removeLogo) {
    const { data: current } = await supabase
      .from("settings")
      .select("header_logo_path")
      .eq("id", true)
      .maybeSingle();

    const { error: updateError } = await supabase
      .from("settings")
      .update({ header_logo_url: null, header_logo_path: null })
      .eq("id", true);

    if (updateError) {
      console.error("updateLogo remove", updateError);
      return;
    }

    if (current?.header_logo_path) {
      await supabase.storage.from("pages").remove([current.header_logo_path]);
    }
  }
}

export async function updateSettings(formData: FormData) {
  const shopName = formData.get("shop_name");
  const contactEmail = formData.get("contact_email");
  const usdRateInput = formData.get("usd_rate");

  if (typeof shopName !== "string" || !shopName.trim()) return;
  if (typeof contactEmail !== "string" || !contactEmail.trim()) return;

  const parsedUsdRate =
    typeof usdRateInput === "string" ? Number(usdRateInput) : NaN;
  if (!Number.isFinite(parsedUsdRate) || parsedUsdRate <= 0) return;

  const supabase = await createClient();

  await updateLogo(supabase, formData);

  const updates: Record<string, unknown> = {
    shop_name: shopName.trim(),
    contact_email: contactEmail.trim(),
    usd_rate: parsedUsdRate,
    notify_email_per_order: formData.get("notify_email_per_order") === "on",
    notify_realtime_popup: formData.get("notify_realtime_popup") === "on",
  };

  const { error } = await supabase.from("settings").update(updates).eq("id", true);
  if (error) console.error("updateSettings", error);

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
}
