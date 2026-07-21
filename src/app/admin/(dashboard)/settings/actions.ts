"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CURRENCY_LABELS, type CurrencyCode } from "@/lib/currency";

function emptyToNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function updateSettings(formData: FormData) {
  const shopName = formData.get("shop_name");
  const contactEmail = formData.get("contact_email");
  const currencyInput = formData.get("currency");

  if (typeof shopName !== "string" || !shopName.trim()) return;
  if (typeof contactEmail !== "string" || !contactEmail.trim()) return;

  const currency: CurrencyCode =
    typeof currencyInput === "string" && currencyInput in CURRENCY_LABELS
      ? (currencyInput as CurrencyCode)
      : "EUR";

  const supabase = await createClient();

  const updates: Record<string, unknown> = {
    shop_name: shopName.trim(),
    contact_email: contactEmail.trim(),
    currency,
    payment_kkiapay: formData.get("payment_kkiapay") === "on",
    payment_fedapay: formData.get("payment_fedapay") === "on",
    notify_email_per_order: formData.get("notify_email_per_order") === "on",
    notify_realtime_popup: formData.get("notify_realtime_popup") === "on",
    social_instagram: emptyToNull(formData.get("social_instagram")),
    social_facebook: emptyToNull(formData.get("social_facebook")),
    social_whatsapp: emptyToNull(formData.get("social_whatsapp")),
    social_youtube: emptyToNull(formData.get("social_youtube")),
    social_tiktok: emptyToNull(formData.get("social_tiktok")),
    social_patreon: emptyToNull(formData.get("social_patreon")),
  };

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

    if (!uploadError) {
      const { data: publicUrlData } = supabase.storage
        .from("pages")
        .getPublicUrl(path);

      updates.header_logo_url = publicUrlData.publicUrl;
      updates.header_logo_path = path;

      if (current?.header_logo_path) {
        await supabase.storage.from("pages").remove([current.header_logo_path]);
      }
    }
  } else if (removeLogo) {
    const { data: current } = await supabase
      .from("settings")
      .select("header_logo_path")
      .eq("id", true)
      .maybeSingle();

    if (current?.header_logo_path) {
      await supabase.storage.from("pages").remove([current.header_logo_path]);
    }

    updates.header_logo_url = null;
    updates.header_logo_path = null;
  }

  await supabase.from("settings").update(updates).eq("id", true);

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
}
