"use client";

import { useActionState } from "react";
import { createPage, type CreatePageState } from "./actions";

const initialState: CreatePageState = { error: null };

export function CreatePageForm() {
  const [state, formAction, pending] = useActionState(createPage, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 border border-zinc-200 bg-white p-6"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          Titre
        </label>
        <input
          name="title"
          required
          placeholder="Ex: Mentions légales"
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          URL (optionnel)
        </label>
        <input
          name="slug"
          placeholder="ex: mentions-legales"
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" name="show_in_menu" />
        Ajouter au menu
      </label>
      <button
        type="submit"
        disabled={pending}
        className="bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? "Création..." : "+ Créer la page"}
      </button>
      {state.error ? <p className="w-full text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
