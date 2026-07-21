"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidateMenu() {
  revalidatePath("/admin/menu");
  revalidatePath("/", "layout");
}

export async function createMenuItem(formData: FormData) {
  const label = formData.get("label");
  const href = formData.get("href");
  if (typeof label !== "string" || !label.trim()) return;
  if (typeof href !== "string" || !href.trim()) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("menu_items")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (last?.position ?? -1) + 1;

  await supabase.from("menu_items").insert({
    label: label.trim(),
    href: href.trim(),
    position: nextPosition,
  });

  revalidateMenu();
}

export async function updateMenuItem(id: number, formData: FormData) {
  const label = formData.get("label");
  const href = formData.get("href");
  if (typeof label !== "string" || !label.trim()) return;
  if (typeof href !== "string" || !href.trim()) return;

  const supabase = await createClient();
  await supabase
    .from("menu_items")
    .update({ label: label.trim(), href: href.trim() })
    .eq("id", id);

  revalidateMenu();
}

export async function deleteMenuItem(id: number) {
  const supabase = await createClient();
  await supabase.from("menu_items").delete().eq("id", id);

  revalidateMenu();
}

export async function moveMenuItem(id: number, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("menu_items")
    .select("id, position")
    .order("position", { ascending: true });

  if (!items) return;

  const index = items.findIndex((item) => item.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= items.length) return;

  const current = items[index];
  const target = items[targetIndex];

  await supabase.from("menu_items").update({ position: target.position }).eq("id", current.id);
  await supabase.from("menu_items").update({ position: current.position }).eq("id", target.id);

  revalidateMenu();
}
