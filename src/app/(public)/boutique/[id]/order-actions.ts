"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type OrderFormState = {
  success: boolean;
  error: string | null;
};

export async function createOrder(
  productId: number,
  productTitle: string,
  unitPrice: number,
  _prevState: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const name = formData.get("name");
  const email = formData.get("email");
  const phone = formData.get("phone");
  const address = formData.get("address");

  if (typeof name !== "string" || !name.trim()) {
    return { success: false, error: "Merci de renseigner votre nom." };
  }
  if (typeof email !== "string" || !email.trim()) {
    return { success: false, error: "Merci de renseigner votre email." };
  }

  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      customer_name: name.trim(),
      customer_email: email.trim(),
      customer_phone:
        typeof phone === "string" && phone.trim() ? phone.trim() : null,
      shipping_address:
        typeof address === "string" && address.trim() ? address.trim() : null,
    })
    .select("id")
    .single();

  if (error || !order) {
    return {
      success: false,
      error: "Impossible d'enregistrer la commande. Réessayez.",
    };
  }

  await supabase.from("order_items").insert({
    order_id: order.id,
    product_id: productId,
    product_title: productTitle,
    unit_price: unitPrice,
    quantity: 1,
  });

  revalidatePath(`/boutique/${productId}`);
  revalidatePath("/boutique");
  revalidatePath("/admin/orders");
  revalidatePath("/admin");

  return { success: true, error: null };
}
