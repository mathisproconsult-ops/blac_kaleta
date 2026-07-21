import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrency } from "@/lib/settings";
import { formatPrice } from "@/lib/currency";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  type OrderStatus,
} from "./orders/status";

export const metadata: Metadata = {
  title: "Overview — Admin Blac_Kaleta",
};
const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
});

type OrderRow = {
  id: number;
  customer_name: string;
  status: OrderStatus;
  created_at: string;
  order_items: { unit_price: number; quantity: number }[];
};

function orderTotal(order: OrderRow) {
  return order.order_items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );
}

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [{ data: orders }, { data: products }, currency] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, customer_name, status, created_at, order_items(unit_price, quantity)",
      )
      .order("created_at", { ascending: false })
      .returns<OrderRow[]>(),
    supabase.from("products").select("id, stock"),
    getCurrency(),
  ]);

  const allOrders = orders ?? [];
  const allProducts = products ?? [];

  const salesToday = allOrders
    .filter((order) => new Date(order.created_at) >= startOfToday)
    .reduce((sum, order) => sum + orderTotal(order), 0);

  const ordersThisWeek = allOrders.filter(
    (order) => new Date(order.created_at) >= sevenDaysAgo,
  ).length;

  const productsInStock = allProducts.filter((product) => product.stock > 0).length;
  const lowStock = allProducts.filter(
    (product) => product.stock > 0 && product.stock <= 2,
  ).length;

  const recentOrders = allOrders.slice(0, 4);

  return (
    <div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Overview
      </h1>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Ventes du jour" value={formatPrice(salesToday, currency)} />
        <StatCard label="Commandes cette semaine" value={String(ordersThisWeek)} />
        <StatCard label="Produits en stock" value={String(productsInStock)} />
        <StatCard label="Stock faible" value={String(lowStock)} />
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Commandes récentes
      </h2>

      {recentOrders.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">Aucune commande pour l&apos;instant.</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
          {recentOrders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center gap-3 py-3">
              <p className="text-sm text-zinc-500">#{order.id}</p>
              <p className="min-w-[120px] flex-1 text-sm font-medium">{order.customer_name}</p>
              <p className="text-sm text-zinc-600">
                {dateFormatter.format(new Date(order.created_at))}
              </p>
              <p className="text-sm">{formatPrice(orderTotal(order), currency)}</p>
              <span
                className={`px-2 py-1 text-xs font-medium ${ORDER_STATUS_STYLES[order.status]}`}
              >
                {ORDER_STATUS_LABELS[order.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
