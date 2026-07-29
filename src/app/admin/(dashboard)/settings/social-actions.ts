"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SOCIAL_PLATFORMS } from "@/lib/social-platforms";

function revalidateSocial() {
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
}

function isValidPlatform(value: FormDataEntryValue | null) {
  return typeof value === "string" && SOCIAL_PLATFORMS.some((platform) => platform.key === value);
}

export async function createSocialLink(formData: FormData) {
  const platform = formData.get("platform");
  const url = formData.get("url");
  if (!isValidPlatform(platform)) return;
  if (typeof url !== "string" || !url.trim()) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("social_links")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("social_links").insert({
    platform,
    url: url.trim(),
    position: (last?.position ?? -1) + 1,
  });

  revalidateSocial();
}

export async function deleteSocialLink(id: number) {
  const supabase = await createClient();
  await supabase.from("social_links").delete().eq("id", id);

  revalidateSocial();
}

export async function moveSocialLink(id: number, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("social_links")
    .select("id, position")
    .order("position", { ascending: true });

  if (!items) return;

  const index = items.findIndex((item) => item.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= items.length) return;

  const current = items[index];
  const target = items[targetIndex];

  await supabase.from("social_links").update({ position: target.position }).eq("id", current.id);
  await supabase.from("social_links").update({ position: current.position }).eq("id", target.id);

  revalidateSocial();
}
