import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/currency";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { deleteOrder, markOrdersAsRead } from "./actions";
import { OrderStatusSelect } from "./order-status-select";
import { OrderFilters } from "./order-filters";
import { ORDER_STATUS_ORDER, type OrderStatus } from "./status";

export const metadata: Metadata = {
  title: "Commandes — Admin Blac_Kaleta",
};
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
  order_items: {
    unit_price: number;
    quantity: number;
    product_title: string;
    selected_options: { label: string; priceDelta: number }[] | null;
  }[];
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; tri?: string }>;
}) {
  const { statut = "toutes", tri = "recent" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      "id, customer_name, customer_email, status, read, created_at, order_items(unit_price, quantity, product_title, selected_options)",
    );

  if (ORDER_STATUS_ORDER.includes(statut as OrderStatus)) {
    query = query.eq("status", statut);
  }

  const [{ data, error }, { count: unreadCount }] = await Promise.all([
    query.order("created_at", { ascending: false }).returns<OrderRow[]>(),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("read", false),
  ]);

  let orders = data ?? [];

  const withTotal = orders.map((order) => ({
    order,
    total: order.order_items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
  }));

  if (tri === "ancien") {
    withTotal.sort(
      (a, b) => new Date(a.order.created_at).getTime() - new Date(b.order.created_at).getTime(),
    );
  } else if (tri === "montant-desc") {
    withTotal.sort((a, b) => b.total - a.total);
  } else if (tri === "montant-asc") {
    withTotal.sort((a, b) => a.total - b.total);
  }
  // "recent" (par défaut) : déjà trié par created_at desc côté requête.

  orders = withTotal.map((entry) => entry.order);
  const totalByOrderId = new Map(withTotal.map((entry) => [entry.order.id, entry.total]));

  return (
    <div>
      {(unreadCount ?? 0) > 0 ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 bg-black px-4 py-3 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
          <p>
            ● {unreadCount} nouvelle{(unreadCount ?? 0) > 1 ? "s" : ""} commande
            {(unreadCount ?? 0) > 1 ? "s" : ""} reçue{(unreadCount ?? 0) > 1 ? "s" : ""}
          </p>
          <form action={markOrdersAsRead}>
            <SubmitButton pendingText="…" className="underline">
              Marquer comme lu
            </SubmitButton>
          </form>
        </div>
      ) : null}

      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Commandes
      </h1>

      <div className="mt-4">
        <OrderFilters statut={statut} tri={tri} />
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          Erreur de chargement : {error.message}
        </p>
      ) : null}

      {orders.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucune commande ne correspond.</p>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-100 dark:border-zinc-800">
          {orders.map((order) => {
            const total = totalByOrderId.get(order.id) ?? 0;
            const items = order.order_items
              .map((item) =>
                item.selected_options && item.selected_options.length > 0
                  ? `${item.product_title} (${item.selected_options.map((option) => option.label).join(", ")})`
                  : item.product_title,
              )
              .join(", ");

            return (
              <li key={order.id} className="flex flex-wrap items-center gap-3 py-3">
                <p className="text-sm text-zinc-500">#{order.id}</p>
                <Link href={`/admin/orders/${order.id}`} className="min-w-[160px] flex-1 hover:underline">
                  <p className="text-sm font-medium">{order.customer_name}</p>
                  <p className="text-xs text-zinc-500">
                    {order.customer_email} — {items}
                  </p>
                </Link>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {dateFormatter.format(new Date(order.created_at))}
                </p>
                <p className="text-sm">{formatPrice(total)}</p>
                <OrderStatusSelect orderId={order.id} status={order.status} />
                <form action={deleteOrder.bind(null, order.id)}>
                  <ConfirmSubmitButton
                    confirmMessage="Es-tu sûr de vouloir supprimer cette commande ? Cette action est irréversible."
                    pendingText="…"
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    Supprimer
                  </ConfirmSubmitButton>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
