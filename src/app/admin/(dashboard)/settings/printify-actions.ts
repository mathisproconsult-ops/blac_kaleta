"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { listShopProducts, PrintifyApiError, type PrintifyProduct } from "@/lib/printify";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type PrintifyActionState = { success: boolean; error: string | null };

export async function updatePrintifyCredentials(
  _prevState: PrintifyActionState,
  formData: FormData,
): Promise<PrintifyActionState> {
  const apiKey = formData.get("printify_api_key");
  const shopId = formData.get("printify_shop_id");

  if (typeof apiKey !== "string" || typeof shopId !== "string") {
    return { success: false, error: "Champs invalides." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      printify_api_key: apiKey.trim() || null,
      printify_shop_id: shopId.trim() || null,
    })
    .eq("id", true);

  if (error) {
    console.error("updatePrintifyCredentials", error);
    return { success: false, error: "Erreur base de données : " + error.message };
  }

  revalidatePath("/admin/settings");
  return { success: true, error: null };
}

// Le prix Printify est en cents USD (ex: 1999 = 19.99 $) : on le convertit
// en FCFA avec le même taux indicatif que le reste du site (settings.usd_rate),
// faute d'un prix natif en FCFA côté Printify.
function priceCentsToXof(cents: number, usdRate: number): number {
  return Math.round((cents / 100) * usdRate);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function findOrCreateOptionGroup(
  supabase: SupabaseClient,
  name: string,
): Promise<number> {
  const { data: existing } = await supabase
    .from("option_groups")
    .select("id")
    .ilike("name", name)
    .maybeSingle();

  if (existing) return existing.id as number;

  const { data: created, error } = await supabase
    .from("option_groups")
    .insert({ name, selection_type: "single" })
    .select("id")
    .single();

  if (error || !created) throw new Error(error?.message ?? "Création du groupe d'options impossible");
  return created.id as number;
}

async function findOrCreateOptionChoice(
  supabase: SupabaseClient,
  groupId: number,
  label: string,
  priceDelta: number,
  printifyVariantId: string | null,
): Promise<number> {
  const { data: existing } = await supabase
    .from("option_choices")
    .select("id")
    .eq("group_id", groupId)
    .ilike("label", label)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("option_choices")
      .update({ price_delta: priceDelta, printify_variant_id: printifyVariantId })
      .eq("id", existing.id);
    return existing.id as number;
  }

  const { data: created, error } = await supabase
    .from("option_choices")
    .insert({
      group_id: groupId,
      label,
      price_delta: priceDelta,
      printify_variant_id: printifyVariantId,
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(error?.message ?? "Création du choix d'option impossible");
  return created.id as number;
}

async function syncProductOptions(
  supabase: SupabaseClient,
  productId: number,
  printifyProduct: PrintifyProduct,
  basePriceCents: number,
  usdRate: number,
) {
  const enabledVariants = printifyProduct.variants.filter((v) => v.is_enabled);
  const singleDimension = printifyProduct.options.length === 1;

  for (const [position, dimension] of printifyProduct.options.entries()) {
    const groupId = await findOrCreateOptionGroup(supabase, dimension.name);

    await supabase
      .from("product_option_groups")
      .upsert({ product_id: productId, group_id: groupId, position }, { onConflict: "product_id,group_id" });

    for (const value of dimension.values) {
      const matchingVariants = enabledVariants.filter((v) => v.options.includes(value.id));
      if (matchingVariants.length === 0) continue;

      const cheapest = Math.min(...matchingVariants.map((v) => v.price));
      const priceDelta = priceCentsToXof(cheapest, usdRate) - priceCentsToXof(basePriceCents, usdRate);

      // Un choix (ex: "Rouge") correspond à une valeur d'une seule dimension
      // Printify, alors qu'une commande Printify réelle se transmet par
      // variant_id (combinaison taille+couleur). On ne peut donc mapper
      // fidèlement l'id de variante que lorsque le produit n'a qu'une seule
      // dimension d'option ; sinon ce sera à raccorder au moment de brancher
      // la transmission de commande (voir migration 0028).
      const printifyVariantId =
        singleDimension && matchingVariants.length === 1
          ? String(matchingVariants[0].id)
          : null;

      await findOrCreateOptionChoice(supabase, groupId, value.title, priceDelta, printifyVariantId);
    }
  }
}

async function syncProductImages(
  supabase: SupabaseClient,
  productId: number,
  printifyProduct: PrintifyProduct,
) {
  await supabase.from("product_images").delete().eq("product_id", productId);

  const images = printifyProduct.images.filter((image) => image.src);
  for (const [position, image] of images.entries()) {
    await supabase.from("product_images").insert({
      product_id: productId,
      path: image.src,
      url: image.src,
      position,
    });
  }
}

export type PrintifySyncState = { success: boolean; error: string | null; imported: number };

// Signature imposée par useActionState : ni l'état précédent ni le FormData
// ne sont nécessaires, la synchronisation ne dépend d'aucun champ de formulaire.
export async function syncPrintifyProducts(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: PrintifySyncState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<PrintifySyncState> {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("settings")
    .select("printify_api_key, printify_shop_id, usd_rate")
    .eq("id", true)
    .maybeSingle();

  if (!settings?.printify_api_key || !settings?.printify_shop_id) {
    return { success: false, error: "Renseigne la clé API et le Shop ID Printify avant de synchroniser.", imported: 0 };
  }

  let printifyProducts: PrintifyProduct[];
  try {
    printifyProducts = await listShopProducts(settings.printify_api_key, settings.printify_shop_id);
  } catch (err) {
    const message = err instanceof PrintifyApiError ? err.message : "Impossible de joindre Printify.";
    console.error("syncPrintifyProducts fetch", err);
    return { success: false, error: message, imported: 0 };
  }

  const usdRate = settings.usd_rate ?? 610;
  let imported = 0;

  for (const printifyProduct of printifyProducts) {
    const enabledVariants = printifyProduct.variants.filter((v) => v.is_enabled);
    if (enabledVariants.length === 0) continue;

    const basePriceCents = Math.min(...enabledVariants.map((v) => v.price));
    const hasAvailableStock = enabledVariants.some((v) => v.is_available);

    const productFields = {
      title: printifyProduct.title,
      description: stripHtml(printifyProduct.description ?? ""),
      price: priceCentsToXof(basePriceCents, usdRate),
      stock: 999,
      status: hasAvailableStock ? "available" : "out_of_stock",
      source: "printify",
      printify_product_id: printifyProduct.id,
      is_visible: printifyProduct.visible,
    };

    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("printify_product_id", printifyProduct.id)
      .maybeSingle();

    let productId: number;
    if (existing) {
      productId = existing.id as number;
      const { error } = await supabase.from("products").update(productFields).eq("id", productId);
      if (error) {
        console.error("syncPrintifyProducts update", printifyProduct.id, error);
        continue;
      }
    } else {
      const { data: created, error } = await supabase
        .from("products")
        .insert(productFields)
        .select("id")
        .single();
      if (error || !created) {
        console.error("syncPrintifyProducts insert", printifyProduct.id, error);
        continue;
      }
      productId = created.id as number;
    }

    try {
      await syncProductImages(supabase, productId, printifyProduct);
      await syncProductOptions(supabase, productId, printifyProduct, basePriceCents, usdRate);
    } catch (err) {
      console.error("syncPrintifyProducts options/images", printifyProduct.id, err);
    }

    imported += 1;
  }

  revalidatePath("/admin/products");
  revalidatePath("/boutique");
  revalidatePath("/");

  return { success: true, error: null, imported };
}
