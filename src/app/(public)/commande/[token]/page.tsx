import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/currency";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/app/admin/(dashboard)/orders/status";
import { DownloadBookButton } from "./download-book-button";

export const metadata: Metadata = {
  title: "Suivi de commande — Blac_Kaleta",
};

type OrderItem = {
  id: number;
  product_id: number | null;
  product_title: string;
  unit_price: number;
  quantity: number;
};

// Page publique sans compte client : l'accès repose sur la connaissance du
// jeton dans l'URL (reçu à la confirmation de commande), pas sur une
// session — d'où l'utilisation du client à privilèges élevés pour la
// lecture, RLS ne pouvant pas exprimer "cette seule ligne, via ce jeton".
export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, status, created_at, payment_verified, order_items(id, product_id, product_title, unit_price, quantity)",
    )
    .eq("access_token", token)
    .maybeSingle();

  if (!order) notFound();

  const items = (order.order_items ?? []) as OrderItem[];
  const productIds = items
    .map((item) => item.product_id)
    .filter((id): id is number => id !== null);

  const digitalBookProductIds = new Set<number>();
  if (productIds.length > 0) {
    const { data: rows } = await supabase
      .from("products")
      .select("id, is_digital_book")
      .in("id", productIds);
    for (const row of (rows ?? []) as { id: number; is_digital_book: boolean }[]) {
      if (row.is_digital_book) digitalBookProductIds.add(row.id);
    }
  }

  const total = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const status = order.status as OrderStatus;

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <h1 className="text-2xl font-semibold uppercase tracking-wide">Suivi de commande</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Commande #{order.id} — statut : {ORDER_STATUS_LABELS[status] ?? status}
      </p>

      <ul className="mt-8 divide-y divide-zinc-100 border-y border-zinc-100 dark:border-zinc-800">
        {items.map((item) => {
          const isDigitalBook = item.product_id !== null && digitalBookProductIds.has(item.product_id);
          return (
            <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div>
                <p className="text-sm font-medium">{item.product_title}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Quantité : {item.quantity} × {formatPrice(item.unit_price)}
                </p>
                {isDigitalBook ? (
                  order.payment_verified ? (
                    <div className="mt-3">
                      <DownloadBookButton token={token} orderItemId={item.id} />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-500">
                      Livre numérique — en attente de vérification du paiement. Le lien de
                      téléchargement apparaîtra ici une fois débloqué.
                    </p>
                  )
                ) : null}
              </div>
              <p className="text-sm font-medium">{formatPrice(item.unit_price * item.quantity)}</p>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 flex items-center justify-end gap-3 text-sm font-semibold">
        Total <span className="text-base">{formatPrice(total)}</span>
      </p>

      <p className="mt-8 text-xs text-zinc-500">
        Garde ce lien pour revenir vérifier le statut de ta commande.
      </p>
    </div>
  );
}
