"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SelectionType = "single" | "multiple";
export type DeliveryNature = "physical" | "digital";

function parsePriceDelta(value: FormDataEntryValue | null): number {
  if (typeof value !== "string" || !value.trim()) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDeliveryNature(value: FormDataEntryValue | null): DeliveryNature {
  return value === "digital" ? "digital" : "physical";
}

export async function createOptionGroup(formData: FormData) {
  const name = formData.get("name");
  const selectionType = formData.get("selection_type");
  if (typeof name !== "string" || !name.trim()) return;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("option_groups")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("option_groups").insert({
    name: name.trim(),
    selection_type: selectionType === "multiple" ? "multiple" : "single",
    position: (last?.position ?? -1) + 1,
  });

  revalidatePath("/admin/options");
}

export async function updateOptionGroup(id: number, formData: FormData) {
  const name = formData.get("name");
  const selectionType = formData.get("selection_type");
  if (typeof name !== "string" || !name.trim()) return;

  const supabase = await createClient();
  await supabase
    .from("option_groups")
    .update({
      name: name.trim(),
      selection_type: selectionType === "multiple" ? "multiple" : "single",
    })
    .eq("id", id);

  revalidatePath("/admin/options");
}

export async function deleteOptionGroup(id: number) {
  const supabase = await createClient();
  await supabase.from("option_groups").delete().eq("id", id);

  revalidatePath("/admin/options");
  revalidatePath("/admin/products");
}

export async function moveOptionGroup(id: number, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: groups } = await supabase
    .from("option_groups")
    .select("id, position")
    .order("position", { ascending: true });

  if (!groups) return;

  const index = groups.findIndex((group) => group.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= groups.length) return;

  const current = groups[index];
  const target = groups[targetIndex];

  await supabase.from("option_groups").update({ position: target.position }).eq("id", current.id);
  await supabase.from("option_groups").update({ position: current.position }).eq("id", target.id);

  revalidatePath("/admin/options");
}

async function uploadDigitalFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  file: File,
) {
  const path = `options/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage
    .from("media")
    .upload(path, file, { contentType: file.type });

  if (error) return null;

  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return { path, url: data.publicUrl, filename: file.name };
}

export async function createOptionChoice(groupId: number, formData: FormData) {
  const label = formData.get("label");
  if (typeof label !== "string" || !label.trim()) return;

  const priceDelta = parsePriceDelta(formData.get("price_delta"));
  const deliveryNature = parseDeliveryNature(formData.get("delivery_nature"));

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("option_choices")
    .select("position")
    .eq("group_id", groupId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const insert: Record<string, unknown> = {
    group_id: groupId,
    label: label.trim(),
    price_delta: priceDelta,
    delivery_nature: deliveryNature,
    position: (last?.position ?? -1) + 1,
  };

  if (deliveryNature === "digital") {
    const file = formData.get("digital_file");
    if (file instanceof File && file.size > 0) {
      const uploaded = await uploadDigitalFile(supabase, file);
      if (uploaded) {
        insert.digital_file_path = uploaded.path;
        insert.digital_file_url = uploaded.url;
        insert.digital_file_name = uploaded.filename;
      }
    }
  }

  await supabase.from("option_choices").insert(insert);

  revalidatePath("/admin/options");
}

export async function updateOptionChoice(id: number, formData: FormData) {
  const label = formData.get("label");
  if (typeof label !== "string" || !label.trim()) return;

  const priceDelta = parsePriceDelta(formData.get("price_delta"));
  const deliveryNature = parseDeliveryNature(formData.get("delivery_nature"));
  const removeFile = formData.get("remove_digital_file") === "on";

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("option_choices")
    .select("digital_file_path")
    .eq("id", id)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    label: label.trim(),
    price_delta: priceDelta,
    delivery_nature: deliveryNature,
  };

  const previousFilePath = current?.digital_file_path ?? null;
  let deleteOldFile = false;

  if (deliveryNature !== "digital" || removeFile) {
    updates.digital_file_path = null;
    updates.digital_file_url = null;
    updates.digital_file_name = null;
    deleteOldFile = true;
  }

  if (deliveryNature === "digital") {
    const file = formData.get("digital_file");
    if (file instanceof File && file.size > 0) {
      const uploaded = await uploadDigitalFile(supabase, file);
      if (uploaded) {
        updates.digital_file_path = uploaded.path;
        updates.digital_file_url = uploaded.url;
        updates.digital_file_name = uploaded.filename;
        deleteOldFile = true;
      }
    }
  }

  if (deleteOldFile && previousFilePath) {
    await supabase.storage.from("media").remove([previousFilePath]);
  }

  await supabase.from("option_choices").update(updates).eq("id", id);

  revalidatePath("/admin/options");
}

export async function deleteOptionChoice(id: number) {
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("option_choices")
    .select("digital_file_path")
    .eq("id", id)
    .maybeSingle();

  if (current?.digital_file_path) {
    await supabase.storage.from("media").remove([current.digital_file_path]);
  }

  await supabase.from("option_choices").delete().eq("id", id);

  revalidatePath("/admin/options");
}

export async function moveOptionChoice(
  groupId: number,
  id: number,
  direction: "up" | "down",
) {
  const supabase = await createClient();
  const { data: choices } = await supabase
    .from("option_choices")
    .select("id, position")
    .eq("group_id", groupId)
    .order("position", { ascending: true });

  if (!choices) return;

  const index = choices.findIndex((choice) => choice.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= choices.length) return;

  const current = choices[index];
  const target = choices[targetIndex];

  await supabase.from("option_choices").update({ position: target.position }).eq("id", current.id);
  await supabase.from("option_choices").update({ position: current.position }).eq("id", target.id);

  revalidatePath("/admin/options");
}
