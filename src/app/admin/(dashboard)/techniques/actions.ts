"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidateTechniques() {
  revalidatePath("/admin/techniques");
  revalidatePath("/admin/products");
  revalidatePath("/oeuvres-recentes");
}

export async function createTechnique(formData: FormData) {
  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("techniques")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (last?.position ?? -1) + 1;

  await supabase
    .from("techniques")
    .insert({ name: name.trim(), position: nextPosition });

  revalidateTechniques();
}

export async function renameTechnique(id: number, formData: FormData) {
  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) return;

  const supabase = await createClient();
  await supabase.from("techniques").update({ name: name.trim() }).eq("id", id);

  revalidateTechniques();
}

export async function deleteTechnique(id: number) {
  const supabase = await createClient();
  await supabase.from("techniques").delete().eq("id", id);

  revalidateTechniques();
}

export async function moveTechnique(id: number, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: techniques } = await supabase
    .from("techniques")
    .select("id, position")
    .order("position", { ascending: true });

  if (!techniques) return;

  const index = techniques.findIndex((technique) => technique.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= techniques.length) return;

  const current = techniques[index];
  const target = techniques[targetIndex];

  await supabase
    .from("techniques")
    .update({ position: target.position })
    .eq("id", current.id);
  await supabase
    .from("techniques")
    .update({ position: current.position })
    .eq("id", target.id);

  revalidateTechniques();
}
