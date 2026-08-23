import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import {
  createTechnique,
  deleteTechnique,
  moveTechnique,
  renameTechnique,
} from "./actions";

export const metadata: Metadata = {
  title: "Techniques — Admin Blac_Kaleta",
};

export default async function TechniquesPage() {
  const supabase = await createClient();
  const { data: techniques, error } = await supabase
    .from("techniques")
    .select("id, name, position")
    .order("position", { ascending: true });

  const list = techniques ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Techniques
      </h1>
      <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Ces techniques apparaissent en liste déroulante sur la fiche produit,
        et alimentent le filtre &laquo;&nbsp;Toutes les techniques&nbsp;&raquo;
        sur Œuvres récentes.
      </p>

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          Erreur de chargement : {error.message}
        </p>
      ) : null}

      <form action={createTechnique} className="mt-6 flex gap-2">
        <input
          name="name"
          placeholder="Ex: Huile sur toile"
          required
          className="flex-1 max-w-sm border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
        />
        <SubmitButton
          pendingText="Ajout…"
          className="bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          + Ajouter
        </SubmitButton>
      </form>

      {list.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucune technique pour l&apos;instant.</p>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-100 dark:border-zinc-800">
          {list.map((technique, index) => (
            <li key={technique.id} className="py-3">
              <form
                action={renameTechnique.bind(null, technique.id)}
                className="flex flex-wrap items-center gap-3"
              >
                <div className="flex flex-col">
                  <SubmitButton
                    formAction={moveTechnique.bind(null, technique.id, "up")}
                    disabled={index === 0}
                    aria-label="Monter"
                    className="text-xs text-zinc-500 hover:text-black disabled:opacity-20 dark:hover:text-zinc-100"
                  >
                    ▲
                  </SubmitButton>
                  <SubmitButton
                    formAction={moveTechnique.bind(null, technique.id, "down")}
                    disabled={index === list.length - 1}
                    aria-label="Descendre"
                    className="text-xs text-zinc-500 hover:text-black disabled:opacity-20 dark:hover:text-zinc-100"
                  >
                    ▼
                  </SubmitButton>
                </div>
                <input
                  name="name"
                  defaultValue={technique.name}
                  className="flex-1 max-w-sm border border-transparent px-2 py-1 text-sm hover:border-zinc-300 focus:border-black focus:outline-none dark:hover:border-zinc-600 dark:focus:border-zinc-100"
                />
                <SubmitButton
                  pendingText="Enregistrement…"
                  className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
                >
                  Enregistrer
                </SubmitButton>
                <SubmitButton
                  formAction={deleteTechnique.bind(null, technique.id)}
                  pendingText="Suppression…"
                  className="text-sm text-red-600 hover:underline dark:text-red-400"
                >
                  Supprimer
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
