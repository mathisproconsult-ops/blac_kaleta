"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ORDER_STATUS_ORDER, type OrderStatus } from "./status";

export async function cycleOrderStatus(id: number, currentStatus: OrderStatus) {
  const supabase = await createClient();
  const currentIndex = ORDER_STATUS_ORDER.indexOf(currentStatus);
  const nextIndex = Math.min(currentIndex + 1, ORDER_STATUS_ORDER.length - 1);
  const nextStatus = ORDER_STATUS_ORDER[nextIndex];

  await supabase.from("orders").update({ status: nextStatus }).eq("id", id);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

export async function markOrdersAsRead() {
  const supabase = await createClient();
  await supabase.from("orders").update({ read: true }).eq("read", false);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}
