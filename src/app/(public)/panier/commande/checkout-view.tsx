"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/currency";
import { createCartOrder, type CheckoutState } from "./actions";

const initialState: CheckoutState = { success: false, error: null };

export function CheckoutView() {
  const { items, subtotal, clear } = useCart();
  const [state, formAction, pending] = useActionState(createCartOrder, initialState);

  useEffect(() => {
    if (state.success) clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear() ne doit s'exécuter qu'à la confirmation, pas à chaque changement du panier
  }, [state.success]);

  if (state.success) {
    return (
      <p className="mt-8 border border-zinc-300 px-4 py-3 text-sm dark:border-zinc-700">
        Votre commande a bien été reçue, nous vous recontactons pour le
        paiement.
      </p>
    );
  }

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

  const cartPayload = JSON.stringify(
    items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      optionChoiceIds: item.selectedOptions.map((option) => option.choiceId),
    })),
  );

  return (
    <form action={formAction} className="mt-8 grid gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <input type="hidden" name="cart" value={cartPayload} />
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">Nom complet</label>
          <input
            name="name"
            required
            className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">Email</label>
          <input
            name="email"
            type="email"
            required
            className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Téléphone (optionnel)
          </label>
          <input
            name="phone"
            className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Adresse de livraison (optionnel)
          </label>
          <textarea
            name="address"
            rows={2}
            className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
        </div>
        {state.error ? <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="self-start bg-black px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {pending ? "Envoi…" : "Confirmer la commande"}
        </button>
        <p className="text-xs text-zinc-500">
          Paiement à régler avec l&apos;artiste après confirmation.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide">Récapitulatif</h2>
        <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100 dark:border-zinc-800">
          {items.map((item, index) => (
            <li
              key={`${item.productId}-${index}`}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                {item.selectedOptions.length > 0 ? (
                  <p className="text-xs text-zinc-500">
                    {item.selectedOptions.map((option) => option.label).join(", ")}
                  </p>
                ) : null}
                <p className="text-xs text-zinc-500">Qté : {item.quantity}</p>
              </div>
              <p className="text-sm">
                {item.price !== null
                  ? formatPrice(item.price * item.quantity)
                  : "—"}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="text-sm font-semibold uppercase tracking-wide">Total</p>
          <p className="text-lg font-semibold">{formatPrice(subtotal)}</p>
        </div>
      </div>
    </form>
  );
}
