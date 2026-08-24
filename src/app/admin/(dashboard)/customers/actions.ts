"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Il n'existe pas de table "clients" séparée : un client est une agrégation
// de ses commandes (même nom/email). Le supprimer revient donc à supprimer
// toutes ses commandes — c'est bien ce que l'admin voit disparaître de la
// liste. Les articles liés (order_items) partent avec, via la contrainte
// on delete cascade déjà en place.
export async function deleteCustomer(email: string) {
  const supabase = await createClient();
  await supabase.from("orders").delete().eq("customer_email", email);
  revalidatePath("/admin/customers");
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  redirect("/admin/customers");
}
