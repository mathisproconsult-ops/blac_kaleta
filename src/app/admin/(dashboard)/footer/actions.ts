"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidateFooter() {
  revalidatePath("/admin/footer");
  revalidatePath("/", "layout");
}

export async function updateFooterCopyright(formData: FormData) {
  const text = formData.get("footer_copyright_text");
  if (typeof text !== "string" || !text.trim()) return;

  const supabase = await createClient();
  await supabase
    .from("settings")
    .update({ footer_copyright_text: text.trim() })
    .eq("id", true);

  revalidateFooter();
}

export async function createFooterLink(formData: FormData) {
  const label = formData.get("label");
  const href = formData.get("href");
  if (typeof label !== "string" || !label.trim()) return;
  if (typeof href !== "string" || !href.trim()) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("footer_links")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("footer_links").insert({
    label: label.trim(),
    href: href.trim(),
    position: (last?.position ?? -1) + 1,
  });

  revalidateFooter();
}

export async function updateFooterLink(id: number, formData: FormData) {
  const label = formData.get("label");
  const href = formData.get("href");
  if (typeof label !== "string" || !label.trim()) return;
  if (typeof href !== "string" || !href.trim()) return;

  const supabase = await createClient();
  await supabase
    .from("footer_links")
    .update({ label: label.trim(), href: href.trim() })
    .eq("id", id);

  revalidateFooter();
}

export async function deleteFooterLink(id: number) {
  const supabase = await createClient();
  await supabase.from("footer_links").delete().eq("id", id);

  revalidateFooter();
}

export async function moveFooterLink(id: number, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("footer_links")
    .select("id, position")
    .order("position", { ascending: true });

  if (!items) return;

  const index = items.findIndex((item) => item.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= items.length) return;

  const current = items[index];
  const target = items[targetIndex];

  await supabase
    .from("footer_links")
    .update({ position: target.position })
    .eq("id", current.id);
  await supabase
    .from("footer_links")
    .update({ position: current.position })
    .eq("id", target.id);

  revalidateFooter();
}
