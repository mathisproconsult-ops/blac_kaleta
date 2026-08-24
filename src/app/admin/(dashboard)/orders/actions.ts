"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ORDER_STATUS_ORDER, type OrderStatus } from "./status";

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
