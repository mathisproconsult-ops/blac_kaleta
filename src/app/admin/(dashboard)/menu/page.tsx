import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  createMenuItem,
  deleteMenuItem,
  moveMenuItem,
  updateMenuItem,
} from "./actions";

export const metadata: Metadata = {
  title: "Menu — Admin Blac_Kaleta",
};

export default async function MenuPage() {
  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from("menu_items")
    .select("id, label, href, position")
    .order("position", { ascending: true });

  const menuItems = items ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">Menu</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Ces éléments s&apos;affichent dans la navigation du site public, dans
        cet ordre.
      </p>

      {error ? (
        <p className="mt-4 text-sm text-red-600">
          Erreur de chargement : {error.message}
        </p>
      ) : null}

      <form action={createMenuItem} className="mt-6 flex flex-wrap gap-2">
        <input
          name="label"
          placeholder="Libellé (ex: Boutique)"
          required
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
        <input
          name="href"
          placeholder="Lien (ex: /boutique)"
          required
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
        <button
          type="submit"
          className="bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          + Ajouter
        </button>
      </form>

      {menuItems.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucun élément de menu.</p>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-100">
          {menuItems.map((item, index) => (
            <li key={item.id} className="flex items-center gap-3 py-3">
              <form
                action={updateMenuItem.bind(null, item.id)}
                className="flex flex-1 items-center gap-3"
              >
                <div className="flex flex-col">
                  <button
                    type="submit"
                    formAction={moveMenuItem.bind(null, item.id, "up")}
                    disabled={index === 0}
                    aria-label="Monter"
                    className="text-xs text-zinc-500 hover:text-black disabled:opacity-20"
                  >
                    ▲
                  </button>
                  <button
                    type="submit"
                    formAction={moveMenuItem.bind(null, item.id, "down")}
                    disabled={index === menuItems.length - 1}
                    aria-label="Descendre"
                    className="text-xs text-zinc-500 hover:text-black disabled:opacity-20"
                  >
                    ▼
                  </button>
                </div>
                <input
                  name="label"
                  defaultValue={item.label}
                  className="flex-1 max-w-[220px] border border-transparent px-2 py-1 text-sm hover:border-zinc-300 focus:border-black focus:outline-none"
                />
                <input
                  name="href"
                  defaultValue={item.href}
                  className="flex-1 max-w-[220px] border border-transparent px-2 py-1 text-sm text-zinc-600 hover:border-zinc-300 focus:border-black focus:outline-none"
                />
                <button type="submit" className="text-sm text-zinc-600 hover:underline">
                  Enregistrer
                </button>
                <button
                  type="submit"
                  formAction={deleteMenuItem.bind(null, item.id)}
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
