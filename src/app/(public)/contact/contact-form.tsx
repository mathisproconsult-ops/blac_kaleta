"use client";

import { useActionState } from "react";
import { sendContactMessage, type ContactFormState } from "./actions";

const initialState: ContactFormState = { success: false, error: null };

export function ContactForm() {
  const [state, formAction, pending] = useActionState(
    sendContactMessage,
    initialState,
  );

  if (state.success) {
    return (
      <p className="mt-6 border border-zinc-300 px-4 py-3 text-sm">
        Merci, votre message a bien été envoyé.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-6 flex max-w-md flex-col gap-3">
      <input
        name="name"
        placeholder="Nom"
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
      <textarea
        name="message"
        placeholder="Message"
        rows={5}
        required
        className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
      />
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-start bg-black px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? "Envoi..." : "Envoyer"}
      </button>
    </form>
  );
}
