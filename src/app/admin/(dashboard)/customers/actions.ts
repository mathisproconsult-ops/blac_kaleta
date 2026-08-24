"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CreateCustomerState = { success: boolean; error: string | null };

export async function createCustomer(
  _prevState: CreateCustomerState,
  formData: FormData,
): Promise<CreateCustomerState> {
  const name = formData.get("name");
  const email = formData.get("email");
  const phone = formData.get("phone");

  if (typeof name !== "string" || !name.trim()) {
    return { success: false, error: "Le nom est obligatoire." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("customers").insert({
    name: name.trim(),
    email: typeof email === "string" && email.trim() ? email.trim() : null,
    phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
  });

  if (error) {
    console.error("createCustomer", error);
    const message = error.code === "23505" ? "Un client existe déjà avec cet email." : error.message;
    return { success: false, error: "Erreur base de données : " + message };
  }

  revalidatePath("/admin/customers");
  return { success: true, error: null };
}

// ilike() traite % et _ comme des jokers : à échapper avant de l'utiliser
// pour un email précis (un "_" est un caractère valide dans une adresse).
function escapeLikePattern(value: string) {
  return value.replace(/[%_]/g, (char) => `\\${char}`);
}

// La clé vient de get-customers.ts : "id:123" (client réel sans commande
// en ligne à recouper) ou "email:adresse" (recoupe une éventuelle ligne
// customers ET toutes les commandes portant cet email, en ligne ou
// manuelles). Dans tous les cas ça supprime aussi les commandes liées —
// la popup de confirmation le précise.
export async function deleteCustomer(key: string) {
  const supabase = await createClient();

  if (key.startsWith("email:")) {
    const email = escapeLikePattern(key.slice("email:".length));
    await supabase.from("orders").delete().ilike("customer_email", email);
    await supabase.from("customers").delete().ilike("email", email);
  } else if (key.startsWith("id:")) {
    const id = Number(key.slice("id:".length));
    if (Number.isInteger(id)) {
      // La contrainte on delete cascade sur orders.customer_id retire
      // aussi ses commandes éventuelles.
      await supabase.from("customers").delete().eq("id", id);
    }
  }

  revalidatePath("/admin/customers");
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  redirect("/admin/customers");
}
