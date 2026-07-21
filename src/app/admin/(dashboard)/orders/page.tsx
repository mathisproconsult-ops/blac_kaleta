import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { cycleOrderStatus, markOrdersAsRead } from "./actions";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  type OrderStatus,
} from "./status";

export const metadata: Metadata = {
  title: "Commandes — Admin Blac_Kaleta",
};

const priceFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});
const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
});

type OrderRow = {
  id: number;
  customer_name: string;
  customer_email: string;
  status: OrderStatus;
  read: boolean;
  created_at: string;
  order_items: { unit_price: number; quantity: number; product_title: string }[];
};

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, customer_name, customer_email, status, read, created_at, order_items(unit_price, quantity, product_title)",
    )
    .order("created_at", { ascending: false })
    .returns<OrderRow[]>();

  const orders = data ?? [];
  const unreadCount = orders.filter((order) => !order.read).length;

  return (
    <div>
      {unreadCount > 0 ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 bg-black px-4 py-3 text-sm text-white">
          <p>
            ● {unreadCount} nouvelle{unreadCount > 1 ? "s" : ""} commande
            {unreadCount > 1 ? "s" : ""} reçue{unreadCount > 1 ? "s" : ""}
          </p>
          <form action={markOrdersAsRead}>
            <button type="submit" className="underline">
              Marquer comme lu
            </button>
          </form>
        </div>
      ) : null}

      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Commandes
      </h1>

      {error ? (
        <p className="mt-4 text-sm text-red-600">
          Erreur de chargement : {error.message}
        </p>
      ) : null}

      {orders.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucune commande pour l&apos;instant.</p>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-100">
          {orders.map((order) => {
            const total = order.order_items.reduce(
              (sum, item) => sum + item.unit_price * item.quantity,
              0,
            );
            const items = order.order_items
              .map((item) => item.product_title)
              .join(", ");

            return (
              <li key={order.id} className="flex flex-wrap items-center gap-3 py-3">
                <p className="text-sm text-zinc-500">#{order.id}</p>
                <div className="min-w-[160px] flex-1">
                  <p className="text-sm font-medium">{order.customer_name}</p>
                  <p className="text-xs text-zinc-500">
                    {order.customer_email} — {items}
                  </p>
                </div>
                <p className="text-sm text-zinc-600">
                  {dateFormatter.format(new Date(order.created_at))}
                </p>
                <p className="text-sm">{priceFormatter.format(total)}</p>
                <form action={cycleOrderStatus.bind(null, order.id, order.status)}>
                  <button
                    type="submit"
                    className={`px-2 py-1 text-xs font-medium ${ORDER_STATUS_STYLES[order.status]}`}
                  >
                    {ORDER_STATUS_LABELS[order.status]}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
