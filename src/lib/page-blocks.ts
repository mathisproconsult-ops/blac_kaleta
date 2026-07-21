import { createClient } from "@/lib/supabase/server";

export const RESERVED_SLUGS = [
  "home",
  "boutique",
  "contact",
  "oeuvres-recentes",
  "panier",
  "admin",
  "api",
];

const ACCENTS: Record<string, string> = {
  a: "àáâãäå",
  e: "éèêë",
  i: "ìíîï",
  o: "òóôõö",
  u: "ùúûü",
  c: "ç",
  n: "ñ",
  y: "ýÿ",
};

function removeAccents(value: string): string {
  let result = value.toLowerCase();
  for (const [plain, accented] of Object.entries(ACCENTS)) {
    for (const char of accented) {
      result = result.split(char).join(plain);
    }
  }
  return result;
}

export function slugify(value: string): string {
  return removeAccents(value)
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
