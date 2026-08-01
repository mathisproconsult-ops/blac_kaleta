"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SOCIAL_PLATFORMS } from "@/lib/social-platforms";

export type SocialLinkState = { success: boolean; error: string | null };

function revalidateSocial() {
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
}

function isValidPlatform(value: FormDataEntryValue | null) {
  return typeof value === "string" && SOCIAL_PLATFORMS.some((platform) => platform.key === value);
}

export async function createSocialLink(
  _prevState: SocialLinkState,
  formData: FormData,
): Promise<SocialLinkState> {
  const platform = formData.get("platform");
  const url = formData.get("url");

  if (!isValidPlatform(platform)) {
    return { success: false, error: "Choisis un réseau dans la liste." };
  }
  if (typeof url !== "string" || !url.trim()) {
    return { success: false, error: "Le lien ne peut pas être vide." };
  }

  const supabase = await createClient();

  const { data: last, error: lastError } = await supabase
    .from("social_links")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastError) {
    console.error("createSocialLink select", lastError);
    return { success: false, error: `Erreur base de données : ${lastError.message}` };
  }

  const { error: insertError } = await supabase.from("social_links").insert({
    platform,
    url: url.trim(),
    position: (last?.position ?? -1) + 1,
  });

  if (insertError) {
    console.error("createSocialLink insert", insertError);
    return { success: false, error: `Échec de l'enregistrement : ${insertError.message}` };
  }

  revalidateSocial();
  return { success: true, error: null };
}

export async function deleteSocialLink(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("social_links").delete().eq("id", id);
  if (error) console.error("deleteSocialLink", error);

  revalidateSocial();
}

export async function moveSocialLink(id: number, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from("social_links")
    .select("id, position")
    .order("position", { ascending: true });

  if (error) {
    console.error("moveSocialLink select", error);
    return;
  }
  if (!items) return;

  const index = items.findIndex((item) => item.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= items.length) return;

  const current = items[index];
  const target = items[targetIndex];

  const { error: updateError1 } = await supabase
    .from("social_links")
    .update({ position: target.position })
    .eq("id", current.id);
  const { error: updateError2 } = await supabase
    .from("social_links")
    .update({ position: current.position })
    .eq("id", target.id);

  if (updateError1) console.error("moveSocialLink update1", updateError1);
  if (updateError2) console.error("moveSocialLink update2", updateError2);

  revalidateSocial();
}
