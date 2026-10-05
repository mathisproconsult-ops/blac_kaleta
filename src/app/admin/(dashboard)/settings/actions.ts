"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { optimizeAndStoreDecorImage } from "@/lib/artwork-storage";

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

    const uploaded = await optimizeAndStoreDecorImage(supabase, "pages", "branding", logoFile);
    if (!uploaded) {
      console.error("updateLogo upload failed");
      return;
    }

    const { error: updateError } = await supabase
      .from("settings")
      .update({ header_logo_url: uploaded.url, header_logo_path: uploaded.path })
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
  const hqMaxDimensionInput = formData.get("image_hq_max_dimension");
  const hqQualityInput = formData.get("image_hq_quality");

  if (typeof shopName !== "string" || !shopName.trim()) return;
  if (typeof contactEmail !== "string" || !contactEmail.trim()) return;

  const parsedUsdRate =
    typeof usdRateInput === "string" ? Number(usdRateInput) : NaN;
  if (!Number.isFinite(parsedUsdRate) || parsedUsdRate <= 0) return;

  // Résolution max (px) et qualité WebP (1-100) de la copie haute qualité
  // (fiche produit + lightbox uniquement, voir lib/settings.ts). Bornes
  // larges mais sûres : en dessous de 800px la copie HQ n'apporterait rien
  // par rapport à la copie principale (1200px), au-dessus de 4000px le
  // poids de page deviendrait disproportionné pour un gain invisible.
  const parsedHqMaxDimension =
    typeof hqMaxDimensionInput === "string" ? Number(hqMaxDimensionInput) : NaN;
  const parsedHqQuality = typeof hqQualityInput === "string" ? Number(hqQualityInput) : NaN;
  if (!Number.isFinite(parsedHqMaxDimension) || parsedHqMaxDimension < 800 || parsedHqMaxDimension > 4000) return;
  if (!Number.isFinite(parsedHqQuality) || parsedHqQuality < 1 || parsedHqQuality > 100) return;

  const supabase = await createClient();

  await updateLogo(supabase, formData);

  const updates: Record<string, unknown> = {
    shop_name: shopName.trim(),
    contact_email: contactEmail.trim(),
    usd_rate: parsedUsdRate,
    notify_email_per_order: formData.get("notify_email_per_order") === "on",
    notify_realtime_popup: formData.get("notify_realtime_popup") === "on",
    image_hq_max_dimension: Math.round(parsedHqMaxDimension),
    image_hq_quality: Math.round(parsedHqQuality),
  };

  let { error } = await supabase.from("settings").update(updates).eq("id", true);
  // image_hq_* peuvent ne pas encore exister si la migration 0043 n'a pas
  // été appliquée : retente sans elles plutôt que de bloquer tout
  // l'enregistrement des autres champs du formulaire.
  if (error) {
    const { image_hq_max_dimension: _hqd, image_hq_quality: _hqq, ...withoutHq } = updates;
    void _hqd;
    void _hqq;
    ({ error } = await supabase.from("settings").update(withoutHq).eq("id", true));
  }
  if (error) console.error("updateSettings", error);

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  updateTag("settings");
}
