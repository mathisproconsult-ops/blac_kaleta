"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STATUS_ORDER, type ProductStatus } from "./status";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function parseCategoryIds(formData: FormData): number[] {
  return formData
    .getAll("categoryIds")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));
}

function productFieldsFromFormData(formData: FormData) {
  const title = formData.get("title");
  const price = formData.get("price");
  const stock = formData.get("stock");
  const description = formData.get("description");
  const year = formData.get("year");
  const series = formData.get("series");
  const technique = formData.get("technique");

  if (typeof title !== "string" || !title.trim()) return null;
  if (typeof price !== "string" || !price) return null;

  return {
    title: title.trim(),
    price: Number(price),
    stock: typeof stock === "string" && stock ? Number(stock) : 0,
    description:
      typeof description === "string" && description.trim()
        ? description.trim()
        : null,
    year: typeof year === "string" && year ? Number(year) : null,
    series: typeof series === "string" && series.trim() ? series.trim() : null,
    technique:
      typeof technique === "string" && technique.trim()
        ? technique.trim()
        : null,
  };
}

async function uploadImages(
  supabase: SupabaseClient,
  productId: number,
  files: File[],
  startPosition: number,
) {
  let position = startPosition;
  for (const file of files) {
    if (!file || file.size === 0) continue;

    const path = `${productId}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("products")
      .upload(path, file, { contentType: file.type });
    if (uploadError) continue;

    const { data: publicUrlData } = supabase.storage
      .from("products")
      .getPublicUrl(path);

    await supabase.from("product_images").insert({
      product_id: productId,
      path,
      url: publicUrlData.publicUrl,
      position,
    });
    position += 1;
  }
}

async function syncCategories(
  supabase: SupabaseClient,
  productId: number,
  categoryIds: number[],
) {
  await supabase.from("product_categories").delete().eq("product_id", productId);
  if (categoryIds.length > 0) {
    await supabase.from("product_categories").insert(
      categoryIds.map((categoryId) => ({
        product_id: productId,
        category_id: categoryId,
      })),
    );
  }
}

export async function createProduct(formData: FormData) {
  const fields = productFieldsFromFormData(formData);
  if (!fields) return;

  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .insert(fields)
    .select("id")
    .single();

  if (error || !product) return;

  await syncCategories(supabase, product.id, parseCategoryIds(formData));

  const files = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File);
  await uploadImages(supabase, product.id, files, 0);

  revalidatePath("/admin/products");
}

export async function updateProduct(id: number, formData: FormData) {
  const fields = productFieldsFromFormData(formData);
  if (!fields) return;

  const supabase = await createClient();
  await supabase.from("products").update(fields).eq("id", id);

  await syncCategories(supabase, id, parseCategoryIds(formData));

  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id);

  const files = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File);
  await uploadImages(supabase, id, files, count ?? 0);

  revalidatePath("/admin/products");
}

export async function deleteProduct(id: number) {
  const supabase = await createClient();

  const { data: files } = await supabase.storage.from("products").list(String(id));
  if (files && files.length > 0) {
    await supabase.storage
      .from("products")
      .remove(files.map((file) => `${id}/${file.name}`));
  }

  await supabase.from("products").delete().eq("id", id);
  revalidatePath("/admin/products");
}

export async function deleteProductImage(imageId: number, path: string) {
  const supabase = await createClient();
  await supabase.storage.from("products").remove([path]);
  await supabase.from("product_images").delete().eq("id", imageId);
  revalidatePath("/admin/products");
}

export async function cycleProductStatus(
  id: number,
  currentStatus: ProductStatus,
) {
  const supabase = await createClient();
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const nextStatus = STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length];
  await supabase.from("products").update({ status: nextStatus }).eq("id", id);
  revalidatePath("/admin/products");
}
