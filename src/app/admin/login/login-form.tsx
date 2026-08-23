"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm text-zinc-600 dark:text-zinc-400">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm text-zinc-600 dark:text-zinc-400">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 bg-black py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? "Connexion..." : "Se connecter"}
      </button>
    </form>
  );
}
