import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/currency";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { deleteCustomer } from "../actions";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  type OrderStatus,
} from "../../orders/status";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

// ilike() traite % et _ comme des jokers : à échapper avant de l'utiliser
// pour un email précis (un "_" est un caractère valide dans une adresse).
function escapeLikePattern(value: string) {
  return value.replace(/[%_]/g, (char) => `\\${char}`);
}

type OrderRow = {
  id: number;
  customer_name: string;
  status: OrderStatus;
  created_at: string;
  order_items: { unit_price: number; quantity: number }[];
};

async function getCustomerDetail(key: string) {
  const supabase = await createClient();

  if (key.startsWith("id:")) {
    const id = Number(key.slice("id:".length));
    if (!Number.isInteger(id)) return null;

    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, email, phone")
      .eq("id", id)
      .maybeSingle();
    if (!customer) return null;

    const { data: orders } = await supabase
      .from("orders")
      .select("id, customer_name, status, created_at, order_items(unit_price, quantity)")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .returns<OrderRow[]>();

    return { name: customer.name, email: customer.email, phone: customer.phone, orders: orders ?? [] };
  }

  if (key.startsWith("email:")) {
    const rawEmail = key.slice("email:".length);
    const email = escapeLikePattern(rawEmail);

    const [{ data: customer }, { data: orders }] = await Promise.all([
      supabase.from("customers").select("name, email, phone").ilike("email", email).maybeSingle(),
      supabase
        .from("orders")
        .select("id, customer_name, status, created_at, order_items(unit_price, quantity)")
        .ilike("customer_email", email)
        .order("created_at", { ascending: false })
        .returns<OrderRow[]>(),
    ]);

    if (!customer && (!orders || orders.length === 0)) return null;

    return {
      name: customer?.name ?? orders?.[0]?.customer_name ?? rawEmail,
      email: customer?.email ?? rawEmail,
      phone: customer?.phone ?? null,
      orders: orders ?? [],
    };
  }

  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const { key } = await params;
  const detail = await getCustomerDetail(decodeURIComponent(key));
  return { title: detail ? `${detail.name} — Clients — Admin Blac_Kaleta` : "Admin Blac_Kaleta" };
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);
  const detail = await getCustomerDetail(key);
  if (!detail) notFound();

  const { name, email, phone, orders } = detail;
  const totalSpent = orders.reduce(
    (sum, order) => sum + order.order_items.reduce((s, item) => s + item.unit_price * item.quantity, 0),
    0,
  );

  return (
    <div>
      <Link href="/admin/customers" className="text-sm text-zinc-500 hover:underline">
        ← Clients
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold uppercase tracking-wide">{name}</h1>
          {email ? <p className="mt-1 text-sm text-zinc-500">{email}</p> : null}
          {phone ? <p className="text-sm text-zinc-500">{phone}</p> : null}
        </div>
        <form action={deleteCustomer.bind(null, key)}>
          <ConfirmSubmitButton
            confirmMessage={
              orders.length > 0
                ? `Es-tu sûr de vouloir supprimer ${name} ? Cela supprimera aussi toutes ses commandes (${orders.length}). Cette action est irréversible.`
                : `Es-tu sûr de vouloir supprimer ${name} ? Cette action est irréversible.`
            }
            pendingText="Suppression…"
            className="border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            Supprimer le client
          </ConfirmSubmitButton>
        </form>
      </div>

      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        {orders.length} commande{orders.length > 1 ? "s" : ""} — {formatPrice(totalSpent)} au total
      </p>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide">Historique des commandes</h2>
      {orders.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Aucune commande pour l&apos;instant.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100 border-y border-zinc-100 dark:border-zinc-800">
          {orders.map((order) => {
            const total = order.order_items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
            return (
              <li key={order.id}>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="flex flex-wrap items-center gap-3 py-3 hover:underline"
                >
                  <p className="text-sm text-zinc-500">#{order.id}</p>
                  <p className="flex-1 text-sm">{dateFormatter.format(new Date(order.created_at))}</p>
                  <span className={`px-2 py-1 text-xs font-medium ${ORDER_STATUS_STYLES[order.status]}`}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                  <p className="text-sm font-medium">{formatPrice(total)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
