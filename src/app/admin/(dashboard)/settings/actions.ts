"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function emptyToNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function updateSettings(formData: FormData) {
  const shopName = formData.get("shop_name");
  const contactEmail = formData.get("contact_email");

  if (typeof shopName !== "string" || !shopName.trim()) return;
  if (typeof contactEmail !== "string" || !contactEmail.trim()) return;

  const supabase = await createClient();
  await supabase
    .from("settings")
    .update({
      shop_name: shopName.trim(),
      contact_email: contactEmail.trim(),
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
    })
    .eq("id", true);

  revalidatePath("/admin/settings");
  revalidatePath("/");
  revalidatePath("/contact");
}
