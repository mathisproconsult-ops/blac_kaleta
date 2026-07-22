"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CheckoutState = {
  success: boolean;
  error: string | null;
};

type CartLine = { productId: number; quantity: number };

function parseCart(formData: FormData): CartLine[] {
  const raw = formData.get("cart");
  if (typeof raw !== "string" || !raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        productId: Number(item?.productId),
        quantity: Number(item?.quantity),
      }))
      .filter(
        (item) => Number.isInteger(item.productId) && Number.isInteger(item.quantity) && item.quantity > 0,
      );
  } catch {
    return [];
  }
}

export async function createCartOrder(
  _prevState: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const name = formData.get("name");
  const email = formData.get("email");
  const phone = formData.get("phone");
  const address = formData.get("address");
  const cartLines = parseCart(formData);

  if (typeof name !== "string" || !name.trim()) {
    return { success: false, error: "Merci de renseigner ton nom." };
  }
  if (typeof email !== "string" || !email.trim()) {
    return { success: false, error: "Merci de renseigner ton email." };
  }
  if (cartLines.length === 0) {
    return { success: false, error: "Ton panier est vide." };
  }

  const supabase = await createClient();

  const productIds = cartLines.map((line) => line.productId);
  const { data: products } = await supabase
    .from("products")
    .select("id, title, price, stock, is_for_sale, is_visible, deleted_at")
    .in("id", productIds);

  const productsById = new Map((products ?? []).map((product) => [product.id, product]));
  const problems: string[] = [];

  for (const line of cartLines) {
    const product = productsById.get(line.productId);
    if (!product || !product.is_for_sale || !product.is_visible || product.deleted_at) {
      problems.push(`« ${product?.title ?? "un article"} » n'est plus disponible à la vente.`);
      continue;
    }
    if (product.price === null) {
      problems.push(`« ${product.title} » n'a pas de prix, contacte-nous directement.`);
      continue;
    }
    if (line.quantity > product.stock) {
      problems.push(
        `Il ne reste que ${product.stock} exemplaire${product.stock > 1 ? "s" : ""} de « ${product.title} » (tu en as demandé ${line.quantity}).`,
      );
    }
  }

  if (problems.length > 0) {
    return {
      success: false,
      error: `Ton panier a besoin d'être ajusté avant de continuer : ${problems.join(" ")}`,
    };
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_name: name.trim(),
      customer_email: email.trim(),
      customer_phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
      shipping_address: typeof address === "string" && address.trim() ? address.trim() : null,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return { success: false, error: "Impossible d'enregistrer la commande, réessaie." };
  }

  for (const line of cartLines) {
    const product = productsById.get(line.productId);
    if (!product || product.price === null) continue;

    await supabase.from("order_items").insert({
      order_id: order.id,
      product_id: product.id,
      product_title: product.title,
      unit_price: product.price,
      quantity: line.quantity,
    });

    const wasUnique = product.stock === 1;
    const newStock = product.stock - line.quantity;
    const updates: Record<string, unknown> = { stock: newStock };

    if (wasUnique) {
      updates.status = "reserved";
    } else if (newStock <= 0) {
      updates.status = "out_of_stock";
    }

    await supabase.from("products").update(updates).eq("id", product.id);
    revalidatePath(`/boutique/${product.id}`);
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidatePath("/boutique");
  revalidatePath("/oeuvres-recentes");
  revalidatePath("/", "layout");

  return { success: true, error: null };
}
