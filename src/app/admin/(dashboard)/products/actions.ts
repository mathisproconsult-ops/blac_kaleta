"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

  return {
    title: title.trim(),
    price: typeof price === "string" && price ? Number(price) : null,
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
    is_for_sale: formData.get("is_for_sale") === "on",
    show_in_recent_works: formData.get("show_in_recent_works") === "on",
    featured_home: formData.get("featured_home") === "on",
  };
}

type UploadedImage = { path: string; url: string; filename: string; mimeType: string };

function parseUploadedImages(formData: FormData): UploadedImage[] {
  const raw = formData.get("uploadedImages");
  if (typeof raw !== "string" || !raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is UploadedImage =>
        typeof item?.path === "string" &&
        typeof item?.url === "string" &&
        typeof item?.filename === "string" &&
        typeof item?.mimeType === "string",
    );
  } catch {
    return [];
  }
}

// Les photos sont envoyées directement du navigateur vers Supabase Storage
// (ImageUploadField), pour ne pas faire transiter le fichier par le corps
// de la Server Action — limité côté plateforme d'hébergement. Cette
// fonction se contente d'enregistrer les métadonnées déjà en ligne.
async function attachUploadedImages(
  supabase: SupabaseClient,
  productId: number,
  images: UploadedImage[],
  startPosition: number,
) {
  let position = startPosition;
  for (const image of images) {
    await supabase.from("product_images").insert({
      product_id: productId,
      path: image.path,
      url: image.url,
      position,
    });
    position += 1;

    // Toute nouvelle photo uploadée depuis le formulaire produit
    // rejoint automatiquement la Médiathèque, déjà associée au produit.
    await supabase.from("media").insert({
      filename: image.filename,
      path: image.path,
      url: image.url,
      mime_type: image.mimeType,
      kind: image.mimeType === "image/gif" ? "gif" : "image",
      product_id: productId,
    });
  }
}

async function attachLibraryMedia(
  supabase: SupabaseClient,
  productId: number,
  mediaIds: number[],
  startPosition: number,
) {
  if (mediaIds.length === 0) return;

  const { data: mediaRows } = await supabase
    .from("media")
    .select("id, path, url")
    .in("id", mediaIds);

  if (!mediaRows) return;

  let position = startPosition;
  for (const media of mediaRows) {
    await supabase.from("product_images").insert({
      product_id: productId,
      path: media.path,
      url: media.url,
      position,
    });
    position += 1;

    await supabase.from("media").update({ product_id: productId }).eq("id", media.id);
  }
}

function parseMediaIds(formData: FormData): number[] {
  return formData
    .getAll("mediaIds")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));
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

  const uploadedImages = parseUploadedImages(formData);
  await attachUploadedImages(supabase, product.id, uploadedImages, 0);
  await attachLibraryMedia(
    supabase,
    product.id,
    parseMediaIds(formData),
    uploadedImages.length,
  );

  revalidatePath("/admin/products");
  revalidatePath("/admin/media");
  revalidatePath("/");
  revalidatePath("/boutique");
  revalidatePath("/oeuvres-recentes");

  redirect("/admin/products");
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

  const uploadedImages = parseUploadedImages(formData);
  await attachUploadedImages(supabase, id, uploadedImages, count ?? 0);
  await attachLibraryMedia(
    supabase,
    id,
    parseMediaIds(formData),
    (count ?? 0) + uploadedImages.length,
  );

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  revalidatePath("/admin/media");
  revalidatePath("/");
  revalidatePath("/boutique");
  revalidatePath("/oeuvres-recentes");

  redirect(`/admin/products/${id}`);
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
  revalidatePath("/");
  revalidatePath("/boutique");
  revalidatePath("/oeuvres-recentes");
}

export async function deleteProductImage(imageId: number, path: string) {
  const supabase = await createClient();
  await supabase.storage.from("products").remove([path]);
  await supabase.from("product_images").delete().eq("id", imageId);
  revalidatePath("/admin/products");
  revalidatePath("/");
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
  revalidatePath("/");
  revalidatePath("/boutique");
}

export async function toggleProductVisibility(
  id: number,
  currentlyVisible: boolean,
) {
  const supabase = await createClient();
  await supabase
    .from("products")
    .update({ is_visible: !currentlyVisible })
    .eq("id", id);

  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/boutique");
  revalidatePath("/oeuvres-recentes");
}

export async function quickUpdateProduct(id: number, formData: FormData) {
  const title = formData.get("title");
  const price = formData.get("price");
  const stock = formData.get("stock");
  const status = formData.get("status");

  if (typeof title !== "string" || !title.trim()) return;
  if (typeof status !== "string" || !STATUS_ORDER.includes(status as ProductStatus)) {
    return;
  }

  const supabase = await createClient();
  await supabase
    .from("products")
    .update({
      title: title.trim(),
      price: typeof price === "string" && price ? Number(price) : null,
      stock: typeof stock === "string" && stock ? Number(stock) : 0,
      status,
    })
    .eq("id", id);

  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/boutique");
}

export async function bulkProductAction(formData: FormData) {
  const bulkAction = formData.get("bulk_action");
  const ids = formData
    .getAll("ids")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));

  if (ids.length === 0 || typeof bulkAction !== "string") return;

  const supabase = await createClient();

  if (bulkAction === "corbeille") {
    await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", ids);
  } else if (bulkAction === "restaurer") {
    await supabase.from("products").update({ deleted_at: null }).in("id", ids);
  } else if (bulkAction === "supprimer") {
    for (const id of ids) {
      const { data: files } = await supabase.storage.from("products").list(String(id));
      if (files && files.length > 0) {
        await supabase.storage
          .from("products")
          .remove(files.map((file) => `${id}/${file.name}`));
      }
    }
    await supabase.from("products").delete().in("id", ids);
  } else {
    return;
  }

  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/boutique");
  revalidatePath("/oeuvres-recentes");
}

export async function trashProduct(id: number) {
  const supabase = await createClient();
  await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/boutique");
  revalidatePath("/oeuvres-recentes");
}

export async function restoreProduct(id: number) {
  const supabase = await createClient();
  await supabase.from("products").update({ deleted_at: null }).eq("id", id);

  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/boutique");
  revalidatePath("/oeuvres-recentes");
}

export async function duplicateProduct(id: number) {
  const supabase = await createClient();
  const { data: original } = await supabase
    .from("products")
    .select(
      "title, price, stock, description, year, series, technique, is_for_sale, show_in_recent_works, featured_home, product_categories(category_id)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!original) return;

  const { data: copy, error } = await supabase
    .from("products")
    .insert({
      title: `${original.title} (copie)`,
      price: original.price,
      stock: original.stock,
      description: original.description,
      year: original.year,
      series: original.series,
      technique: original.technique,
      is_for_sale: original.is_for_sale,
      show_in_recent_works: original.show_in_recent_works,
      featured_home: original.featured_home,
      is_visible: false,
    })
    .select("id")
    .single();

  if (error || !copy) return;

  const categoryIds = original.product_categories.map((pc) => pc.category_id);
  await syncCategories(supabase, copy.id, categoryIds);

  revalidatePath("/admin/products");
}
