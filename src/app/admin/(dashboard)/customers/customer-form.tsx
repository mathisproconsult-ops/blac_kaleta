"use client";

import { useActionState, useEffect, useRef } from "react";
import { Disclosure } from "@/components/disclosure";
import { SubmitButton } from "@/components/submit-button";
import { createCustomer, type CreateCustomerState } from "./actions";

const initialState: CreateCustomerState = { success: false, error: null };

export function CustomerForm() {
  const [state, formAction] = useActionState(createCustomer, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <Disclosure label="+ Ajouter un client" closeLabel="Fermer">
      <form
        ref={formRef}
        action={formAction}
        className="flex flex-wrap items-end gap-3 border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">Nom</label>
          <input
            name="name"
            required
            className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Email (facultatif)
          </label>
          <input
            name="email"
            type="email"
            className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Téléphone (facultatif)
          </label>
          <input
            name="phone"
            type="tel"
            className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
        </div>
        <SubmitButton
          pendingText="Ajout…"
          className="bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Ajouter
        </SubmitButton>

        {state.error ? (
          <p className="w-full border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            ⚠ {state.error}
          </p>
        ) : state.success ? (
          <p className="w-full border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            ✓ Client ajouté.
          </p>
        ) : null}
      </form>
    </Disclosure>
  );
}
