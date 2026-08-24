"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ORDER_STATUS_ORDER, type OrderStatus } from "./status";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function updateOrderStatus(id: number, status: OrderStatus) {
  if (!ORDER_STATUS_ORDER.includes(status)) return;

  const supabase = await createClient();
  await supabase.from("orders").update({ status }).eq("id", id);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin");
}

export async function markOrdersAsRead() {
  const supabase = await createClient();
  await supabase.from("orders").update({ read: true }).eq("read", false);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

export async function deleteOrder(id: number) {
  const supabase = await createClient();
  await supabase.from("orders").delete().eq("id", id);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/customers");
  revalidatePath("/admin");
  redirect("/admin/orders");
}

// ilike() traite % et _ comme des jokers : à échapper avant de l'utiliser
// pour un email précis (un "_" est un caractère valide dans une adresse).
function escapeLikePattern(value: string) {
  return value.replace(/[%_]/g, (char) => `\\${char}`);
}

export type ManualOrderState = { success: boolean; error: string | null };

type ManualLine =
  | { type: "product"; productId: number; quantity: number; optionChoiceIds: number[] }
  | { type: "custom"; title: string; unitPrice: number; quantity: number };

function parseManualLines(formData: FormData): ManualLine[] {
  const raw = formData.get("lines");
  if (typeof raw !== "string" || !raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const lines: ManualLine[] = [];

    for (const item of parsed) {
      if (item?.type === "product") {
        const productId = Number(item.productId);
        const quantity = Number(item.quantity);
        const optionChoiceIds = Array.isArray(item.optionChoiceIds)
          ? item.optionChoiceIds.map(Number).filter((id: number) => Number.isInteger(id))
          : [];
        if (Number.isInteger(productId) && Number.isInteger(quantity) && quantity > 0) {
          lines.push({ type: "product", productId, quantity, optionChoiceIds });
        }
      } else if (item?.type === "custom") {
        const title = typeof item.title === "string" ? item.title.trim() : "";
        const unitPrice = Number(item.unitPrice);
        const quantity = Number(item.quantity);
        if (title && Number.isFinite(unitPrice) && unitPrice >= 0 && Number.isInteger(quantity) && quantity > 0) {
          lines.push({ type: "custom", title, unitPrice, quantity });
        }
      }
    }

    return lines;
  } catch {
    return [];
  }
}

type ResolvedCustomer = {
  customerId: number | null;
  name: string;
  email: string;
  phone: string | null;
};

async function resolveCustomer(
  supabase: SupabaseClient,
  formData: FormData,
): Promise<ResolvedCustomer | { error: string }> {
  const customerMode = formData.get("customerMode");

  if (customerMode === "new") {
    const newName = formData.get("newName");
    const newEmail = formData.get("newEmail");
    const newPhone = formData.get("newPhone");

    if (typeof newName !== "string" || !newName.trim()) {
      return { error: "Le nom du client est obligatoire." };
    }

    const name = newName.trim();
    const email = typeof newEmail === "string" ? newEmail.trim() : "";
    const phone = typeof newPhone === "string" && newPhone.trim() ? newPhone.trim() : null;

    const { data: created, error } = await supabase
      .from("customers")
      .insert({ name, email: email || null, phone })
      .select("id")
      .single();

    if (error || !created) {
      console.error("resolveCustomer create", error);
      const message = error?.code === "23505" ? "Un client existe déjà avec cet email." : error?.message;
      return { error: "Impossible de créer le client : " + (message ?? "erreur inconnue") };
    }

    return { customerId: created.id, name, email, phone };
  }

  const customerKey = formData.get("customerKey");
  if (typeof customerKey !== "string" || !customerKey) {
    return { error: "Choisis un client." };
  }

  if (customerKey.startsWith("id:")) {
    const id = Number(customerKey.slice("id:".length));
    if (!Number.isInteger(id)) return { error: "Client invalide." };

    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, email, phone")
      .eq("id", id)
      .maybeSingle();
    if (!customer) return { error: "Client introuvable." };

    return {
      customerId: customer.id,
      name: customer.name,
      email: customer.email ?? "",
      phone: customer.phone,
    };
  }

  if (customerKey.startsWith("email:")) {
    const email = escapeLikePattern(customerKey.slice("email:".length));

    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, email, phone")
      .ilike("email", email)
      .maybeSingle();
    if (customer) {
      return {
        customerId: customer.id,
        name: customer.name,
        email: customer.email ?? "",
        phone: customer.phone,
      };
    }

    const { data: order } = await supabase
      .from("orders")
      .select("customer_name, customer_email")
      .ilike("customer_email", email)
      .limit(1)
      .maybeSingle();
    if (!order) return { error: "Client introuvable." };

    return { customerId: null, name: order.customer_name, email: order.customer_email, phone: null };
  }

  return { error: "Client invalide." };
}

export async function createManualOrder(
  _prevState: ManualOrderState,
  formData: FormData,
): Promise<ManualOrderState> {
  const status = formData.get("status");
  const note = formData.get("note");
  const shippingAddress = formData.get("shippingAddress");
  const lines = parseManualLines(formData);

  if (lines.length === 0) {
    return { success: false, error: "Ajoute au moins un article à la commande." };
  }
  if (typeof status !== "string" || !ORDER_STATUS_ORDER.includes(status as OrderStatus)) {
    return { success: false, error: "Statut invalide." };
  }

  const supabase = await createClient();

  const customer = await resolveCustomer(supabase, formData);
  if ("error" in customer) {
    return { success: false, error: customer.error };
  }

  const productIds = lines
    .filter((line): line is Extract<ManualLine, { type: "product" }> => line.type === "product")
    .map((line) => line.productId);

  const { data: products } =
    productIds.length > 0
      ? await supabase.from("products").select("id, title, price, stock").in("id", productIds)
      : { data: [] };
  const productsById = new Map((products ?? []).map((product) => [product.id, product]));

  const optionChoiceIds = Array.from(
    new Set(
      lines
        .filter((line): line is Extract<ManualLine, { type: "product" }> => line.type === "product")
        .flatMap((line) => line.optionChoiceIds),
    ),
  );
  const { data: optionChoices } =
    optionChoiceIds.length > 0
      ? await supabase
          .from("option_choices")
          .select("id, label, price_delta, option_groups(name)")
          .in("id", optionChoiceIds)
      : { data: [] };

  type OptionChoiceRow = {
    id: number;
    label: string;
    price_delta: number;
    option_groups: { name: string }[] | { name: string } | null;
  };
  const optionChoicesById = new Map(
    ((optionChoices ?? []) as unknown as OptionChoiceRow[]).map((choice) => [choice.id, choice]),
  );

  function resolveLineOptions(optionChoiceIdList: number[]) {
    return optionChoiceIdList
      .map((choiceId) => optionChoicesById.get(choiceId))
      .filter((choice): choice is OptionChoiceRow => Boolean(choice))
      .map((choice) => {
        const groupName = Array.isArray(choice.option_groups)
          ? choice.option_groups[0]?.name
          : choice.option_groups?.name;
        return { label: groupName ? `${groupName} : ${choice.label}` : choice.label, priceDelta: choice.price_delta };
      });
  }

  for (const line of lines) {
    if (line.type === "product" && !productsById.has(line.productId)) {
      return { success: false, error: "Un des produits sélectionnés n'existe plus." };
    }
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: customer.customerId,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      shipping_address: typeof shippingAddress === "string" && shippingAddress.trim() ? shippingAddress.trim() : null,
      status,
      source: "manual",
      note: typeof note === "string" && note.trim() ? note.trim() : null,
      read: true,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("createManualOrder order", orderError);
    return { success: false, error: "Impossible de créer la commande : " + (orderError?.message ?? "erreur inconnue") };
  }

  for (const line of lines) {
    if (line.type === "custom") {
      await supabase.from("order_items").insert({
        order_id: order.id,
        product_id: null,
        product_title: line.title,
        unit_price: line.unitPrice,
        quantity: line.quantity,
        selected_options: null,
      });
      continue;
    }

    const product = productsById.get(line.productId);
    if (!product) continue;

    const lineOptions = resolveLineOptions(line.optionChoiceIds);
    const unitPrice = product.price + lineOptions.reduce((sum, option) => sum + option.priceDelta, 0);

    await supabase.from("order_items").insert({
      order_id: order.id,
      product_id: product.id,
      product_title: product.title,
      unit_price: unitPrice,
      quantity: line.quantity,
      selected_options: lineOptions.length > 0 ? lineOptions : null,
    });

    // La commande manuelle représente presque toujours une vente déjà
    // effectuée hors-site : on décrémente le stock comme pour une vraie
    // commande, pour que l'inventaire reste juste.
    const newStock = Math.max(0, product.stock - line.quantity);
    const updates: Record<string, unknown> = { stock: newStock };
    if (product.stock === line.quantity) {
      updates.status = "sold";
    } else if (newStock <= 0) {
      updates.status = "out_of_stock";
    }
    await supabase.from("products").update(updates).eq("id", product.id);
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/boutique");

  return { success: true, error: null };
}
