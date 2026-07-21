"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BlockType } from "@/lib/page-blocks";

function revalidatePageSlug(slug: string) {
  revalidatePath(`/admin/pages/${slug}`);
  revalidatePath(`/${slug}`);
}

const DEFAULT_CONTENT: Record<BlockType, Record<string, string>> = {
  titre: { text: "Nouveau titre" },
  texte: { text: "Nouveau texte" },
  image: {},
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
    const path = `${pageSlug}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("pages")
      .upload(path, file, { contentType: file.type });

    if (!uploadError) {
      const { data: publicUrlData } = supabase.storage
        .from("pages")
        .getPublicUrl(path);

      await supabase
        .from("page_blocks")
        .update({
          content: {
            url: publicUrlData.publicUrl,
            path,
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
