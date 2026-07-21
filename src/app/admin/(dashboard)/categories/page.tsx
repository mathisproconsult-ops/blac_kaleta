import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createCategory, deleteCategory, moveCategory, renameCategory } from "./actions";

export const metadata: Metadata = {
  title: "Catégories — Admin Blac_Kaleta",
};

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name, position")
    .order("position", { ascending: true });

  const list = categories ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Catégories
      </h1>

      {error ? (
        <p className="mt-4 text-sm text-red-600">
          Erreur de chargement : {error.message}
        </p>
      ) : null}

      <form action={createCategory} className="mt-6 flex gap-2">
        <input
          name="name"
          placeholder="Nom de la catégorie"
          required
          className="flex-1 max-w-sm border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
        <button
          type="submit"
          className="bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          + Ajouter
        </button>
      </form>

      {list.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucune catégorie pour l&apos;instant.</p>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-100">
          {list.map((category, index) => (
            <li key={category.id} className="flex flex-wrap items-center gap-3 py-3">
              <form
                action={renameCategory.bind(null, category.id)}
                className="flex flex-1 flex-wrap items-center gap-3"
              >
                <div className="flex flex-col">
                  <button
                    type="submit"
                    formAction={moveCategory.bind(null, category.id, "up")}
                    disabled={index === 0}
                    aria-label="Monter"
                    className="text-xs text-zinc-500 hover:text-black disabled:opacity-20"
                  >
                    ▲
                  </button>
                  <button
                    type="submit"
                    formAction={moveCategory.bind(null, category.id, "down")}
                    disabled={index === list.length - 1}
                    aria-label="Descendre"
                    className="text-xs text-zinc-500 hover:text-black disabled:opacity-20"
                  >
                    ▼
                  </button>
                </div>
                <input
                  name="name"
                  defaultValue={category.name}
                  className="flex-1 max-w-sm border border-transparent px-2 py-1 text-sm hover:border-zinc-300 focus:border-black focus:outline-none"
                />
                <button
                  type="submit"
                  className="text-sm text-zinc-600 hover:underline"
                >
                  Enregistrer
                </button>
                <button
                  type="submit"
                  formAction={deleteCategory.bind(null, category.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Supprimer
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
