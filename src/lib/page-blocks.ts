import { createClient } from "@/lib/supabase/server";

export type BlockType = "titre" | "texte" | "image";

export type PageBlock = {
  id: number;
  type: BlockType;
  content: { text?: string; url?: string; path?: string; alt?: string };
  position: number;
};

export async function getPageBlocks(slug: string): Promise<PageBlock[]> {
  const supabase = await createClient();
  const { data: page } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!page) return [];

  const { data: blocks } = await supabase
    .from("page_blocks")
    .select("id, type, content, position")
    .eq("page_id", page.id)
    .order("position", { ascending: true });

  return (blocks ?? []) as PageBlock[];
}
