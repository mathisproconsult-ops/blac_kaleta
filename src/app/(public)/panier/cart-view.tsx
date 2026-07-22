"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatPrice, type CurrencyCode } from "@/lib/currency";

export function CartView({ currency }: { currency: CurrencyCode }) {
  const { items, removeItem, setQuantity, subtotal } = useCart();

  if (items.length === 0) {
    return (
      <p className="mt-8 text-sm text-zinc-500">
        Votre panier est vide.{" "}
        <Link href="/boutique" className="underline">
          Voir la boutique
        </Link>
      </p>
    );
  }

  return (
    <>
      <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-100">
        {items.map((item) => (
          <li key={item.productId} className="flex flex-wrap items-center gap-4 py-4">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image}
                alt={item.title}
                className="h-16 w-16 flex-none object-cover"
              />
            ) : (
              <div className="h-16 w-16 flex-none bg-zinc-100" />
            )}
            <div className="min-w-[140px] flex-1">
              <Link
                href={`/boutique/${item.productId}`}
                className="text-sm font-medium hover:underline"
              >
                {item.title}
              </Link>
              <p className="text-xs text-zinc-500">
                {item.price !== null ? formatPrice(item.price, currency) : "Sur demande"} / unité
              </p>
            </div>
            {item.stock > 1 ? (
              <input
                type="number"
                min={1}
                max={item.stock}
                value={item.quantity}
                onChange={(event) =>
                  setQuantity(item.productId, Number(event.target.value) || 1)
                }
                className="w-16 border border-zinc-300 px-2 py-1 text-sm focus:border-black focus:outline-none"
              />
            ) : (
              <p className="text-sm text-zinc-600">Qté : 1</p>
            )}
            <p className="w-24 text-right text-sm font-medium">
              {item.price !== null
                ? formatPrice(item.price * item.quantity, currency)
                : "—"}
            </p>
            <button
              type="button"
              onClick={() => removeItem(item.productId)}
              className="text-sm text-red-600 hover:underline"
            >
              Retirer
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-200 pt-6">
        <p className="text-lg font-semibold">Total : {formatPrice(subtotal, currency)}</p>
        <button
          type="button"
          disabled
          title="Disponible à la prochaine étape"
          className="cursor-not-allowed bg-black px-6 py-3 text-sm font-medium text-white opacity-40"
        >
          Passer la commande (bientôt)
        </button>
      </div>
    </>
  );
}
