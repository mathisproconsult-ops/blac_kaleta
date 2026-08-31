import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import { Disclosure } from "@/components/disclosure";
import {
  createRecentWorkCategory,
  deleteRecentWorkCategory,
  moveRecentWorkCategory,
  renameRecentWorkCategory,
  updateRecentWorkCategoryCover,
} from "./actions";

export const metadata: Metadata = {
  title: "Œuvres récentes — Admin Blac_Kaleta",
};

export default async function RecentWorkCategoriesPage() {
  const supabase = await createClient();
  const [{ data: categories, error }, { data: media }] = await Promise.all([
    supabase
      .from("recent_work_categories")
      .select("id, name, position, cover_image_url")
      .order("position", { ascending: true }),
    supabase
      .from("media")
      .select("id, filename, url")
      .is("deleted_at", null)
      .in("kind", ["image", "gif"])
      .order("created_at", { ascending: false }),
  ]);

  const list = categories ?? [];
  const mediaList = media ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Œuvres récentes — Catégories
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Les catégories affichées sous forme de vignettes cliquables sur la
        page publique « Œuvres récentes ». Les œuvres (produits) s&apos;y
        rattachent depuis leur fiche produit ; les photos et vidéos se
        gèrent depuis chaque catégorie.
      </p>

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          Erreur de chargement : {error.message}
        </p>
      ) : null}

      <form action={createRecentWorkCategory} className="mt-6 flex gap-2">
        <input
          name="name"
          placeholder="Nom de la catégorie"
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
        <p className="mt-8 text-sm text-zinc-500">Aucune catégorie pour l&apos;instant.</p>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-100 dark:border-zinc-800">
          {list.map((category, index) => (
            <li key={category.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                {category.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={category.cover_image_url}
                    alt={category.name}
                    className="h-10 w-10 flex-none object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 flex-none bg-zinc-100 dark:bg-zinc-800" />
                )}
                <form
                  action={renameRecentWorkCategory.bind(null, category.id)}
                  className="flex flex-1 flex-wrap items-center gap-3"
                >
                  <div className="flex flex-col">
                    <SubmitButton
                      formAction={moveRecentWorkCategory.bind(null, category.id, "up")}
                      disabled={index === 0}
                      aria-label="Monter"
                      className="text-xs text-zinc-500 hover:text-black disabled:opacity-20 dark:hover:text-zinc-100"
                    >
                      ▲
                    </SubmitButton>
                    <SubmitButton
                      formAction={moveRecentWorkCategory.bind(null, category.id, "down")}
                      disabled={index === list.length - 1}
                      aria-label="Descendre"
                      className="text-xs text-zinc-500 hover:text-black disabled:opacity-20 dark:hover:text-zinc-100"
                    >
                      ▼
                    </SubmitButton>
                  </div>
                  <input
                    name="name"
                    defaultValue={category.name}
                    className="flex-1 max-w-sm border border-transparent px-2 py-1 text-sm hover:border-zinc-300 focus:border-black focus:outline-none dark:hover:border-zinc-600 dark:focus:border-zinc-100"
                  />
                  <SubmitButton
                    pendingText="Enregistrement…"
                    className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
                  >
                    Enregistrer
                  </SubmitButton>
                  <SubmitButton
                    formAction={deleteRecentWorkCategory.bind(null, category.id)}
                    pendingText="Suppression…"
                    className="text-sm text-red-600 hover:underline dark:text-red-400"
                  >
                    Supprimer
                  </SubmitButton>
                </form>
                <Link
                  href={`/admin/oeuvres-recentes/${category.id}`}
                  className="text-sm hover:underline"
                >
                  Gérer les photos/vidéos →
                </Link>
              </div>

              <Disclosure label="Image de couverture" closeLabel="Fermer" className="mt-2">
                <form
                  action={updateRecentWorkCategoryCover.bind(null, category.id)}
                  className="flex flex-col gap-3 border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  {category.cover_image_url ? (
                    <label className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                      <input type="checkbox" name="remove_cover" />
                      Retirer l&apos;image de couverture actuelle
                    </label>
                  ) : null}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs uppercase tracking-wide text-zinc-500">
                      Nouvelle image
                    </label>
                    <input type="file" name="cover_file" accept="image/*" className="text-sm" />
                  </div>
                  {mediaList.length > 0 ? (
                    <fieldset className="flex flex-col gap-1">
                      <legend className="text-xs uppercase tracking-wide text-zinc-500">
                        Ou choisir depuis la Médiathèque
                      </legend>
                      <div className="flex flex-wrap gap-3">
                        {mediaList.map((mediaItem) => (
                          <label
                            key={mediaItem.id}
                            className="flex flex-col items-center gap-1 text-xs"
                          >
                            <input type="radio" name="mediaId" value={mediaItem.id} />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={mediaItem.url}
                              alt={mediaItem.filename}
                              className="h-16 w-16 object-cover"
                            />
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}
                  <SubmitButton
                    pendingText="Enregistrement…"
                    className="self-start bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                  >
                    Enregistrer
                  </SubmitButton>
                </form>
              </Disclosure>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
