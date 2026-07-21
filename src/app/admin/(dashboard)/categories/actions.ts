"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createCategory(formData: FormData) {
  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("categories")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (last?.position ?? -1) + 1;

  await supabase
    .from("categories")
    .insert({ name: name.trim(), position: nextPosition });

  revalidatePath("/admin/categories");
}

export async function renameCategory(id: number, formData: FormData) {
  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) return;

  const supabase = await createClient();
  await supabase.from("categories").update({ name: name.trim() }).eq("id", id);

  revalidatePath("/admin/categories");
}

export async function deleteCategory(id: number) {
  const supabase = await createClient();
  await supabase.from("categories").delete().eq("id", id);

  revalidatePath("/admin/categories");
}

export async function moveCategory(id: number, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, position")
    .order("position", { ascending: true });

  if (!categories) return;

  const index = categories.findIndex((category) => category.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= categories.length) return;

  const current = categories[index];
  const target = categories[targetIndex];

  await supabase
    .from("categories")
    .update({ position: target.position })
    .eq("id", current.id);
  await supabase
    .from("categories")
    .update({ position: current.position })
    .eq("id", target.id);

  revalidatePath("/admin/categories");
}
