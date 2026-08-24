import { createClient } from "@/lib/supabase/server";

// Un client peut exister de deux façons : une vraie ligne dans customers
// (créée à la main, ou "promue" depuis une commande en ligne), ou une simple
// agrégation par email des anciennes commandes qui n'ont jamais été liées à
// une ligne customers (tout le tunnel d'achat public, resté inchangé). Cette
// fonction recoupe les deux pour donner une liste unique, sans doublons.
export type AggregatedCustomer = {
  key: string; // "email:adresse" ou "id:123" (clients sans email) — utilisé dans les URLs
  customerId: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  orderCount: number;
  totalSpent: number;
};

type CustomerRow = { id: number; name: string; email: string | null; phone: string | null };
type OrderRow = {
  customer_id: number | null;
  customer_name: string;
  customer_email: string;
  order_items: { unit_price: number; quantity: number }[];
};

export async function getAggregatedCustomers(): Promise<{
  customers: AggregatedCustomer[];
  error: string | null;
}> {
  const supabase = await createClient();

  // Requêtes séparées et best-effort : la table customers peut ne pas
  // encore exister si la migration 0030 n'a pas été appliquée — dans ce
  // cas on retombe sur la seule agrégation par email (comportement
  // d'avant cette fonctionnalité), plutôt que de casser la page.
  const [{ data: customerRows }, { data: orderRows, error: ordersError }] = await Promise.all([
    supabase.from("customers").select("id, name, email, phone"),
    supabase
      .from("orders")
      .select("customer_id, customer_name, customer_email, order_items(unit_price, quantity)")
      .order("created_at", { ascending: false })
      .returns<OrderRow[]>(),
  ]);

  if (ordersError) {
    return { customers: [], error: ordersError.message };
  }

  const byKey = new Map<string, AggregatedCustomer>();
  const idToEmailKey = new Map<number, string>();

  for (const row of (customerRows ?? []) as CustomerRow[]) {
    const key = row.email ? `email:${row.email.toLowerCase()}` : `id:${row.id}`;
    if (row.email) idToEmailKey.set(row.id, key);
    byKey.set(key, {
      key,
      customerId: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      orderCount: 0,
      totalSpent: 0,
    });
  }

  for (const order of orderRows ?? []) {
    const total = order.order_items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const key =
      (order.customer_id ? idToEmailKey.get(order.customer_id) : null) ??
      (order.customer_id ? `id:${order.customer_id}` : `email:${order.customer_email.toLowerCase()}`);

    const existing = byKey.get(key);
    if (existing) {
      existing.orderCount += 1;
      existing.totalSpent += total;
    } else {
      byKey.set(key, {
        key,
        customerId: order.customer_id,
        name: order.customer_name,
        email: order.customer_email,
        phone: null,
        orderCount: 1,
        totalSpent: total,
      });
    }
  }

  const customers = Array.from(byKey.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  return { customers, error: null };
}
