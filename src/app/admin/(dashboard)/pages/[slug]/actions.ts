"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { optimizeAndStoreDecorImage } from "@/lib/artwork-storage";
import type { AccordionItem, BlockType } from "@/lib/page-blocks";

function revalidatePageSlug(slug: string) {
  revalidatePath(`/admin/pages/${slug}`);
  revalidatePath(`/${slug}`);
}

const DEFAULT_CONTENT: Record<BlockType, Record<string, unknown>> = {
  titre: { text: "Nouveau titre" },
  texte: { text: "Nouveau texte" },
  image: {},
  accordeon: { qa_items: [{ question: "Nouvelle question", answer: "Réponse" }] },
  liste: { list_items: ["Nouvel élément"] },
};

async function getPageId(pageSlug: string) {
  const supabase = await createClient();
  const { data: page } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", pageSlug)
    .maybeSingle();
  return page?.id ?? null;
}

export async function addBlock(pageSlug: string, type: BlockType) {
  const supabase = await createClient();
  const pageId = await getPageId(pageSlug);
  if (!pageId) return;

  const { data: last } = await supabase
    .from("page_blocks")
    .select("position")
    .eq("page_id", pageId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from("page_blocks").insert({
    page_id: pageId,
    type,
    content: DEFAULT_CONTENT[type],
    position: (last?.position ?? -1) + 1,
  });

  revalidatePageSlug(pageSlug);
}

export async function updateTextBlock(
  id: number,
  pageSlug: string,
  formData: FormData,
) {
  const text = formData.get("text");
  if (typeof text !== "string") return;

  const supabase = await createClient();
  await supabase
    .from("page_blocks")
    .update({ content: { text } })
    .eq("id", id);

  revalidatePageSlug(pageSlug);
}

// Filtre les paires vides (question ET réponse toutes deux blanches) pour
// ne pas publier d'entrée FAQ fantôme laissée par un clic sur "+ Ajouter"
// jamais rempli.
export async function updateAccordionBlock(
  id: number,
  pageSlug: string,
  formData: FormData,
) {
  const raw = formData.get("items");
  if (typeof raw !== "string") return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!Array.isArray(parsed)) return;

  const items: AccordionItem[] = parsed
    .filter(
      (item): item is AccordionItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as AccordionItem).question === "string" &&
        typeof (item as AccordionItem).answer === "string",
    )
    .map((item) => ({ question: item.question.trim(), answer: item.answer.trim() }))
    .filter((item) => item.question || item.answer);

  const supabase = await createClient();
  await supabase
    .from("page_blocks")
    .update({ content: { qa_items: items } })
    .eq("id", id);

  revalidatePageSlug(pageSlug);
}

// Filtre les lignes vides laissées par un clic sur "+ Ajouter" jamais rempli.
export async function updateListBlock(
  id: number,
  pageSlug: string,
  formData: FormData,
) {
  const raw = formData.get("items");
  if (typeof raw !== "string") return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!Array.isArray(parsed)) return;

  const items: string[] = parsed
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const supabase = await createClient();
  await supabase
    .from("page_blocks")
    .update({ content: { list_items: items } })
    .eq("id", id);

  revalidatePageSlug(pageSlug);
}

export async function uploadImageBlock(
  id: number,
  pageSlug: string,
  oldPath: string | null,
  formData: FormData,
) {
  const alt = formData.get("alt");
  const file = formData.get("file");

  const supabase = await createClient();

  if (file instanceof File && file.size > 0) {
    const uploaded = await optimizeAndStoreDecorImage(supabase, "pages", pageSlug, file);

    if (uploaded) {
      await supabase
        .from("page_blocks")
        .update({
          content: {
            url: uploaded.url,
            path: uploaded.path,
            alt: typeof alt === "string" ? alt : "",
          },
        })
        .eq("id", id);

      if (oldPath) {
        await supabase.storage.from("pages").remove([oldPath]);
      }
    }
  } else if (typeof alt === "string") {
    const { data: block } = await supabase
      .from("page_blocks")
      .select("content")
      .eq("id", id)
      .maybeSingle();

    await supabase
      .from("page_blocks")
      .update({ content: { ...(block?.content ?? {}), alt } })
      .eq("id", id);
  }

  revalidatePageSlug(pageSlug);
}

export async function deleteBlock(
  id: number,
  pageSlug: string,
  imagePath: string | null,
) {
  const supabase = await createClient();

  if (imagePath) {
    await supabase.storage.from("pages").remove([imagePath]);
  }
  await supabase.from("page_blocks").delete().eq("id", id);

  revalidatePageSlug(pageSlug);
}

export async function moveBlock(
  id: number,
  pageSlug: string,
  direction: "up" | "down",
) {
  const supabase = await createClient();
  const pageId = await getPageId(pageSlug);
  if (!pageId) return;

  const { data: blocks } = await supabase
    .from("page_blocks")
    .select("id, position")
    .eq("page_id", pageId)
    .order("position", { ascending: true });

  if (!blocks) return;

  const index = blocks.findIndex((block) => block.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= blocks.length) return;

  const current = blocks[index];
  const target = blocks[targetIndex];

  await supabase
    .from("page_blocks")
    .update({ position: target.position })
    .eq("id", current.id);
  await supabase
    .from("page_blocks")
    .update({ position: current.position })
    .eq("id", target.id);

  revalidatePageSlug(pageSlug);
}
