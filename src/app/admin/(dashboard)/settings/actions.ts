"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
    })
    .eq("id", true);

  revalidatePath("/admin/settings");
  revalidatePath("/");
  revalidatePath("/contact");
}
