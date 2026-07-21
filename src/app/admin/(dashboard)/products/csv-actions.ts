"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function stripHtml(value: string): string {
  return value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function parsePrice(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCategoryNames(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const segments = part.split(">").map((segment) => segment.trim());
      return segments[segments.length - 1];
    });
}

function parseImageUrls(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

async function getOrCreateCategoryId(
  supabase: SupabaseClient,
  cache: Map<string, number>,
  name: string,
): Promise<number> {
  const cacheKey = name.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .ilike("name", name)
    .maybeSingle();

  if (existing) {
    cache.set(cacheKey, existing.id);
    return existing.id;
  }

  const { data: last } = await supabase
    .from("categories")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("categories")
    .insert({ name, position: (last?.position ?? -1) + 1 })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(`Impossible de créer la catégorie "${name}"`);
  }

  cache.set(cacheKey, created.id);
  return created.id;
}

async function importProductImage(
  supabase: SupabaseClient,
  productId: number,
  imageUrl: string,
  position: number,
) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return;

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const buffer = await response.arrayBuffer();
    const extension =
      imageUrl.split(".").pop()?.split("?")[0]?.slice(0, 5) || "jpg";
    const path = `${productId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("products")
      .upload(path, buffer, { contentType });
    if (uploadError) return;

    const { data: publicUrlData } = supabase.storage
      .from("products")
      .getPublicUrl(path);

    await supabase.from("product_images").insert({
      product_id: productId,
      path,
      url: publicUrlData.publicUrl,
      position,
    });
  } catch {
    // image ignorée si elle n'est pas accessible
  }
}

export type ImportState = {
  message: string | null;
  error: string | null;
};

export async function importProductsCsv(
  _prevState: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { message: null, error: "Merci de choisir un fichier CSV." };
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    return {
      message: null,
      error: `Erreur de lecture du CSV : ${parsed.errors[0].message}`,
    };
  }

  const supabase = await createClient();
  const categoryCache = new Map<string, number>();

  let created = 0;
  let skipped = 0;

  for (const row of parsed.data) {
    const title = row["Name"]?.trim();
    const price = parsePrice(row["Regular price"] || row["Sale price"]);

    if (!title || price === null) {
      skipped += 1;
      continue;
    }

    const stockRaw = row["Stock"]?.trim();
    const stock = stockRaw ? Number(stockRaw) : 0;
    const validStock = Number.isFinite(stock) ? stock : 0;
    const description = row["Description"] ? stripHtml(row["Description"]) : null;

    const { data: product, error } = await supabase
      .from("products")
      .insert({
        title,
        price,
        stock: validStock,
        status: validStock <= 0 ? "out_of_stock" : "available",
        description,
      })
      .select("id")
      .single();

    if (error || !product) {
      skipped += 1;
      continue;
    }

    const categoryIds: number[] = [];
    for (const name of parseCategoryNames(row["Categories"])) {
      try {
        categoryIds.push(await getOrCreateCategoryId(supabase, categoryCache, name));
      } catch {
        // catégorie ignorée si la création échoue
      }
    }
    if (categoryIds.length > 0) {
      await supabase.from("product_categories").insert(
        categoryIds.map((categoryId) => ({
          product_id: product.id,
          category_id: categoryId,
        })),
      );
    }

    let position = 0;
    for (const imageUrl of parseImageUrls(row["Images"])) {
      await importProductImage(supabase, product.id, imageUrl, position);
      position += 1;
    }

    created += 1;
  }

  revalidatePath("/admin/products");

  return {
    message: `${created} produit(s) importé(s)${
      skipped > 0 ? `, ${skipped} ligne(s) ignorée(s) (titre ou prix manquant)` : ""
    }.`,
    error: null,
  };
}
