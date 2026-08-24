import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/currency";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { deleteOrder } from "../actions";
import { OrderStatusSelect } from "../order-status-select";
import { ORDER_STATUS_LABELS, type OrderStatus } from "../status";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type OrderItem = {
  id: number;
  product_id: number | null;
  product_title: string;
  unit_price: number;
  quantity: number;
  selected_options: { label: string; priceDelta: number }[] | null;
};

type OrderDetail = {
  id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_address: string | null;
  status: OrderStatus;
  created_at: string;
  order_items: OrderItem[];
};

async function getOrder(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, customer_name, customer_email, customer_phone, shipping_address, status, created_at, order_items(id, product_id, product_title, unit_price, quantity, selected_options)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) console.error("getOrder", error);
  if (!data) return null;

  const order = data as unknown as OrderDetail;

  // Requête séparée et best-effort : une vignette manquante ne doit jamais
  // empêcher l'affichage du détail de la commande.
  const productIds = order.order_items
    .map((item) => item.product_id)
    .filter((id): id is number => id !== null);

  const imageByProductId = new Map<number, string>();
  if (productIds.length > 0) {
    const { data: imageRows } = await supabase
      .from("product_images")
      .select("product_id, url, position")
      .in("product_id", productIds)
      .order("position", { ascending: true });
    if (imageRows) {
      for (const row of imageRows as { product_id: number; url: string }[]) {
        if (!imageByProductId.has(row.product_id)) {
          imageByProductId.set(row.product_id, row.url);
        }
      }
    }
  }

  return { order, imageByProductId };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Commande #${id} — Admin Blac_Kaleta` };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getOrder(id);
  if (!result) notFound();
  const { order, imageByProductId } = result;

  const total = order.order_items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  return (
    <div>
      <Link href="/admin/orders" className="text-sm text-zinc-500 hover:underline">
        ← Commandes
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold uppercase tracking-wide">
          Commande #{order.id}
        </h1>
        <div className="flex items-center gap-3">
          <OrderStatusSelect
            orderId={order.id}
            status={order.status}
            className="border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          />
          <form action={deleteOrder.bind(null, order.id)}>
            <ConfirmSubmitButton
              confirmMessage="Es-tu sûr de vouloir supprimer cette commande ? Cette action est irréversible."
              pendingText="Suppression…"
              className="border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              Supprimer
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>

      <p className="mt-1 text-sm text-zinc-500">
        {dateFormatter.format(new Date(order.created_at))} — statut actuel :{" "}
        {ORDER_STATUS_LABELS[order.status]}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide">Articles</h2>
          <ul className="mt-3 divide-y divide-zinc-100 border-y border-zinc-100 dark:border-zinc-800">
            {order.order_items.map((item) => {
              const imageUrl = item.product_id ? imageByProductId.get(item.product_id) : undefined;
              return (
                <li key={item.id} className="flex items-start gap-4 py-4">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt={item.product_title} className="h-16 w-16 flex-none object-cover" />
                  ) : (
                    <div className="h-16 w-16 flex-none bg-zinc-100 dark:bg-zinc-800" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.product_title}</p>
                    {item.selected_options && item.selected_options.length > 0 ? (
                      <ul className="mt-1 text-xs text-zinc-500">
                        {item.selected_options.map((option, index) => (
                          <li key={index}>
                            {option.label}
                            {option.priceDelta ? ` (+${formatPrice(option.priceDelta)})` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="mt-1 text-xs text-zinc-500">
                      Quantité : {item.quantity} × {formatPrice(item.unit_price)}
                    </p>
                  </div>
                  <p className="text-sm font-medium">
                    {formatPrice(item.unit_price * item.quantity)}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 flex items-center justify-end gap-3 text-sm font-semibold">
            Total <span className="text-base">{formatPrice(total)}</span>
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide">Client</h2>
            <p className="mt-2 text-sm">{order.customer_name}</p>
            <p className="text-sm text-zinc-500">{order.customer_email}</p>
            {order.customer_phone ? (
              <p className="text-sm text-zinc-500">{order.customer_phone}</p>
            ) : null}
            <Link
              href={`/admin/customers/${encodeURIComponent(order.customer_email)}`}
              className="mt-2 inline-block text-xs text-zinc-500 hover:underline"
            >
              Voir la fiche client →
            </Link>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide">Livraison</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-400">
              {order.shipping_address || "Non renseignée"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
