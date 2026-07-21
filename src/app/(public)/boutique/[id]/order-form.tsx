"use client";

import { useActionState } from "react";
import { createOrder, type OrderFormState } from "./order-actions";

const initialState: OrderFormState = { success: false, error: null };

export function OrderForm({
  productId,
  productTitle,
  unitPrice,
}: {
  productId: number;
  productTitle: string;
  unitPrice: number;
}) {
  const [state, formAction, pending] = useActionState(
    createOrder.bind(null, productId, productTitle, unitPrice),
    initialState,
  );

  if (state.success) {
    return (
      <p className="border border-zinc-300 px-4 py-3 text-sm">
        Merci, votre commande a été enregistrée. Nous vous recontactons
        rapidement pour la suite.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        name="name"
        placeholder="Nom complet"
        required
        className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
      />
      <input
        name="phone"
        placeholder="Téléphone (optionnel)"
        className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
      />
      <textarea
        name="address"
        placeholder="Adresse de livraison (optionnel)"
        rows={2}
        className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
      />
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start bg-black px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? "Envoi..." : "Commander cette pièce"}
      </button>
      <p className="text-xs text-zinc-500">
        Paiement à régler avec l&apos;artiste après confirmation.
      </p>
    </form>
  );
}
