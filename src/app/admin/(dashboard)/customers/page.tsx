import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CustomerSearch } from "./customer-search";

export const metadata: Metadata = {
  title: "Clients — Admin Blac_Kaleta",
};

type OrderRow = {
  customer_name: string;
  customer_email: string;
  order_items: { unit_price: number; quantity: number }[];
};

type Customer = {
  name: string;
  email: string;
  orderCount: number;
  totalSpent: number;
};

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("customer_name, customer_email, order_items(unit_price, quantity)")
    .order("created_at", { ascending: false })
    .returns<OrderRow[]>();

  const orders = data ?? [];

  const customersByEmail = new Map<string, Customer>();
  for (const order of orders) {
    const key = order.customer_email.toLowerCase();
    const total = order.order_items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    );
    const existing = customersByEmail.get(key);
    if (existing) {
      existing.orderCount += 1;
      existing.totalSpent += total;
    } else {
      customersByEmail.set(key, {
        name: order.customer_name,
        email: order.customer_email,
        orderCount: 1,
        totalSpent: total,
      });
    }
  }

  const customers = Array.from(customersByEmail.values()).sort(
    (a, b) => b.totalSpent - a.totalSpent,
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Clients
      </h1>

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          Erreur de chargement : {error.message}
        </p>
      ) : null}

      {customers.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucun client pour l&apos;instant.</p>
      ) : (
        <CustomerSearch customers={customers} />
      )}
    </div>
  );
}
