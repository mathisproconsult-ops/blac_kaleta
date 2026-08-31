"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { protectAndStoreArtworkImage } from "@/lib/artwork-storage";
import { STATUS_ORDER, type ProductStatus } from "./status";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function parseCategoryIds(formData: FormData): number[] {
  return formData
    .getAll("categoryIds")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));
}

function parseOptionGroupIds(formData: FormData): number[] {
  return formData
    .getAll("optionGroupIds")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));
}

function productFieldsFromFormData(formData: FormData) {
  const title = formData.get("title");
  const price = formData.get("price");
  const stock = formData.get("stock");
  const description = formData.get("description");
  const year = formData.get("year");
  const techniqueId = formData.get("technique_id");

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
    technique_id:
      typeof techniqueId === "string" && techniqueId ? Number(techniqueId) : null,
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
// (protectAndStoreArtworkImage vit dans @/lib/artwork-storage — partagée
// avec les entrées Photo d'Œuvres récentes.)

// La colonne original_path peut ne pas encore exister si la migration 0029
// n'a pas été appliquée : on retente sans elle plutôt que de perdre la photo
// (même filet de sécurité que pour les autres colonnes ajoutées après coup).
async function insertProductImage(
  supabase: SupabaseClient,
  row: { product_id: number; path: string; url: string; original_path: string | null; position: number },
) {
  const { error } = await supabase.from("product_images").insert(row);
  if (error) {
    console.error("insertProductImage", error);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- extrait volontairement du reste pour le retirer de l'insert de repli
    const { original_path: _originalPath, ...withoutOriginalPath } = row;
    await supabase.from("product_images").insert(withoutOriginalPath);
  }
}

async function attachUploadedImages(
  supabase: SupabaseClient,
  productId: number,
  images: UploadedImage[],
  startPosition: number,
) {
  let position = startPosition;
  for (const image of images) {
    const stored = await protectAndStoreArtworkImage(
      supabase,
      String(productId),
      image.path,
      image.mimeType,
    );

    await insertProductImage(supabase, {
      product_id: productId,
      path: stored?.path ?? image.path,
      url: stored?.url ?? image.url,
      original_path: stored?.originalPath ?? null,
      position,
    });
    position += 1;

    // Toute nouvelle photo uploadée depuis le formulaire produit rejoint
    // automatiquement la Médiathèque, déjà associée au produit — avec
    // l'upload brut d'origine, pas la copie protégée.
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
    .select("id, path, url, mime_type")
    .in("id", mediaIds);

  if (!mediaRows) return;

  let position = startPosition;
  for (const media of mediaRows) {
    const stored = await protectAndStoreArtworkImage(
      supabase,
      String(productId),
      media.path,
      media.mime_type ?? "image/jpeg",
    );

    await insertProductImage(supabase, {
      product_id: productId,
      path: stored?.path ?? media.path,
      url: stored?.url ?? media.url,
      original_path: stored?.originalPath ?? null,
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

async function syncOptionGroups(
  supabase: SupabaseClient,
  productId: number,
  groupIds: number[],
) {
  await supabase.from("product_option_groups").delete().eq("product_id", productId);
  if (groupIds.length > 0) {
    await supabase.from("product_option_groups").insert(
      groupIds.map((groupId, index) => ({
        product_id: productId,
        group_id: groupId,
        position: index,
      })),
    );
  }
}

// Appel indépendant du reste des champs produit : recent_work_category_id
// peut ne pas encore exister si la migration 0031 n'a pas été appliquée, et
// ne doit pas faire échouer toute la sauvegarde du produit (même filet de
// sécurité que pour le logo dans les paramètres).
async function syncRecentWorkCategory(
  supabase: SupabaseClient,
  productId: number,
  formData: FormData,
) {
  const raw = formData.get("recent_work_category_id");
  const categoryId = typeof raw === "string" && raw ? Number(raw) : null;

  const { error } = await supabase
    .from("products")
    .update({ recent_work_category_id: categoryId })
    .eq("id", productId);

  if (error) console.error("syncRecentWorkCategory", error);
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
  await syncOptionGroups(supabase, product.id, parseOptionGroupIds(formData));
  await syncRecentWorkCategory(supabase, product.id, formData);

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
  await syncOptionGroups(supabase, id, parseOptionGroupIds(formData));
  await syncRecentWorkCategory(supabase, id, formData);

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

  const { data: originalFiles } = await supabase.storage.from("artwork-originals").list(String(id));
  if (originalFiles && originalFiles.length > 0) {
    await supabase.storage
      .from("artwork-originals")
      .remove(originalFiles.map((file) => `${id}/${file.name}`));
  }

  await supabase.from("products").delete().eq("id", id);
  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/boutique");
  revalidatePath("/oeuvres-recentes");
}

// Le propriétaire du site doit pouvoir récupérer ses originaux haute
// résolution, non filigranés — réservé à l'admin connecté : URL signée
// courte plutôt qu'un accès public au bucket artwork-originals.
export async function getOriginalImageDownloadUrl(
  originalPath: string,
): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("artwork-originals")
    .createSignedUrl(originalPath, 60);

  if (error || !data) {
    console.error("getOriginalImageDownloadUrl", error);
    return { url: null, error: "Original introuvable." };
  }

  return { url: data.signedUrl, error: null };
}

export async function deleteProductImage(imageId: number, path: string, originalPath: string | null) {
  const supabase = await createClient();
  await supabase.storage.from("products").remove([path]);
  if (originalPath) {
    await supabase.storage.from("artwork-originals").remove([originalPath]);
  }
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
      "title, price, stock, description, year, technique_id, is_for_sale, show_in_recent_works, featured_home, product_categories(category_id)",
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
      technique_id: original.technique_id,
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
