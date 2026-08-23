import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import { Disclosure } from "@/components/disclosure";
import {
  createOptionChoice,
  createOptionGroup,
  deleteOptionChoice,
  deleteOptionGroup,
  moveOptionChoice,
  moveOptionGroup,
  updateOptionChoice,
  updateOptionGroup,
} from "./actions";

export const metadata: Metadata = {
  title: "Options — Admin Blac_Kaleta",
};

export const maxDuration = 60;

type OptionChoice = {
  id: number;
  label: string;
  price_delta: number;
  delivery_nature: "physical" | "digital";
  digital_file_url: string | null;
  digital_file_name: string | null;
  position: number;
};

type OptionGroup = {
  id: number;
  name: string;
  selection_type: "single" | "multiple";
  position: number;
  option_choices: OptionChoice[];
};

export default async function OptionsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("option_groups")
    .select("id, name, selection_type, position, option_choices(id, label, price_delta, delivery_nature, digital_file_url, digital_file_name, position)")
    .order("position", { ascending: true })
    .returns<OptionGroup[]>();

  const groups = (data ?? []).map((group) => ({
    ...group,
    option_choices: [...group.option_choices].sort((a, b) => a.position - b.position),
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">Options</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Crée des groupes d&apos;options réutilisables (ex: Dimensions, Format,
        Encadrement) puis choisis lesquels s&apos;appliquent à chaque produit
        depuis sa fiche.
      </p>

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">Erreur de chargement : {error.message}</p>
      ) : null}

      <form action={createOptionGroup} className="mt-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Nom du groupe
          </label>
          <input
            name="name"
            placeholder="Ex: Dimensions"
            required
            className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Type de sélection
          </label>
          <select
            name="selection_type"
            defaultValue="single"
            className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          >
            <option value="single">Choix unique (liste déroulante)</option>
            <option value="multiple">Choix multiples (cases à cocher, prix cumulés)</option>
          </select>
        </div>
        <SubmitButton
          pendingText="Ajout…"
          className="bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          + Créer le groupe
        </SubmitButton>
      </form>

      {groups.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucun groupe d&apos;options pour l&apos;instant.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {groups.map((group, index) => (
            <li key={group.id} className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col">
                  <SubmitButton
                    formAction={moveOptionGroup.bind(null, group.id, "up")}
                    disabled={index === 0}
                    aria-label="Monter"
                    className="text-xs text-zinc-500 hover:text-black disabled:opacity-20 dark:hover:text-zinc-100"
                  >
                    ▲
                  </SubmitButton>
                  <SubmitButton
                    formAction={moveOptionGroup.bind(null, group.id, "down")}
                    disabled={index === groups.length - 1}
                    aria-label="Descendre"
                    className="text-xs text-zinc-500 hover:text-black disabled:opacity-20 dark:hover:text-zinc-100"
                  >
                    ▼
                  </SubmitButton>
                </div>
                <form
                  action={updateOptionGroup.bind(null, group.id)}
                  className="flex flex-1 flex-wrap items-center gap-3"
                >
                  <input
                    name="name"
                    defaultValue={group.name}
                    className="max-w-xs flex-1 border border-transparent px-2 py-1 text-sm font-medium hover:border-zinc-300 focus:border-black focus:outline-none dark:hover:border-zinc-600 dark:focus:border-zinc-100"
                  />
                  <select
                    name="selection_type"
                    defaultValue={group.selection_type}
                    className="border border-zinc-300 px-2 py-1 text-xs focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
                  >
                    <option value="single">Choix unique</option>
                    <option value="multiple">Choix multiples</option>
                  </select>
                  <SubmitButton
                    pendingText="Enregistrement…"
                    className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
                  >
                    Enregistrer
                  </SubmitButton>
                </form>
                <form action={deleteOptionGroup.bind(null, group.id)}>
                  <SubmitButton
                    pendingText="Suppression…"
                    className="text-sm text-red-600 hover:underline dark:text-red-400"
                  >
                    Supprimer le groupe
                  </SubmitButton>
                </form>
              </div>

              <div className="mt-4">
                {group.option_choices.length === 0 ? (
                  <p className="text-sm text-zinc-500">Aucun choix dans ce groupe.</p>
                ) : (
                  <ul className="divide-y divide-zinc-100 border-y border-zinc-100 dark:border-zinc-800">
                    {group.option_choices.map((choice, choiceIndex) => (
                      <li key={choice.id} className="py-3">
                        <form
                          action={updateOptionChoice.bind(null, choice.id)}
                          className="flex flex-wrap items-center gap-3"
                        >
                          <div className="flex flex-col">
                            <SubmitButton
                              formAction={moveOptionChoice.bind(null, group.id, choice.id, "up")}
                              disabled={choiceIndex === 0}
                              aria-label="Monter"
                              className="text-xs text-zinc-500 hover:text-black disabled:opacity-20 dark:hover:text-zinc-100"
                            >
                              ▲
                            </SubmitButton>
                            <SubmitButton
                              formAction={moveOptionChoice.bind(null, group.id, choice.id, "down")}
                              disabled={choiceIndex === group.option_choices.length - 1}
                              aria-label="Descendre"
                              className="text-xs text-zinc-500 hover:text-black disabled:opacity-20 dark:hover:text-zinc-100"
                            >
                              ▼
                            </SubmitButton>
                          </div>
                          <input
                            name="label"
                            defaultValue={choice.label}
                            placeholder="Libellé (ex: 30x40 cm)"
                            required
                            className="max-w-[180px] flex-1 border border-zinc-300 px-2 py-1 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
                          />
                          <input
                            name="price_delta"
                            type="number"
                            step="0.01"
                            defaultValue={choice.price_delta}
                            title="Impact sur le prix (FCFA)"
                            className="w-28 border border-zinc-300 px-2 py-1 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
                          />
                          <select
                            name="delivery_nature"
                            defaultValue={choice.delivery_nature}
                            className="border border-zinc-300 px-2 py-1 text-xs focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
                          >
                            <option value="physical">Physique</option>
                            <option value="digital">Numérique</option>
                          </select>
                          <SubmitButton
                            pendingText="Enregistrement…"
                            className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
                          >
                            Enregistrer
                          </SubmitButton>
                          <SubmitButton
                            formAction={deleteOptionChoice.bind(null, choice.id)}
                            pendingText="Suppression…"
                            className="text-sm text-red-600 hover:underline dark:text-red-400"
                          >
                            Supprimer
                          </SubmitButton>

                          <div className="flex w-full flex-wrap items-center gap-2 pl-8 text-xs text-zinc-500">
                            {choice.digital_file_url ? (
                              <>
                                <a
                                  href={choice.digital_file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline"
                                >
                                  {choice.digital_file_name ?? "Fichier PDF"}
                                </a>
                                <label className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                  <input type="checkbox" name="remove_digital_file" />
                                  Retirer
                                </label>
                              </>
                            ) : null}
                            <span>
                              {choice.digital_file_url ? "Remplacer le PDF :" : "PDF (si numérique) :"}
                            </span>
                            <input
                              type="file"
                              name="digital_file"
                              accept="application/pdf"
                              className="text-xs"
                            />
                          </div>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}

                <Disclosure label="+ Ajouter un choix" closeLabel="Annuler" className="mt-3">
                  <form
                    action={createOptionChoice.bind(null, group.id)}
                    className="flex flex-col gap-3 border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex flex-wrap gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs uppercase tracking-wide text-zinc-500">
                          Libellé
                        </label>
                        <input
                          name="label"
                          placeholder="Ex: 30x40 cm"
                          required
                          className="border border-zinc-300 px-2 py-1 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs uppercase tracking-wide text-zinc-500">
                          Impact prix (FCFA)
                        </label>
                        <input
                          name="price_delta"
                          type="number"
                          step="0.01"
                          defaultValue={0}
                          className="w-32 border border-zinc-300 px-2 py-1 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs uppercase tracking-wide text-zinc-500">
                          Nature de livraison
                        </label>
                        <select
                          name="delivery_nature"
                          defaultValue="physical"
                          className="border border-zinc-300 px-2 py-1 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
                        >
                          <option value="physical">Physique</option>
                          <option value="digital">Numérique</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs uppercase tracking-wide text-zinc-500">
                        Fichier PDF (si choix numérique — livraison automatique branchable plus tard)
                      </label>
                      <input type="file" name="digital_file" accept="application/pdf" className="text-sm" />
                    </div>
                    <SubmitButton
                      pendingText="Ajout…"
                      className="self-start bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    >
                      Ajouter le choix
                    </SubmitButton>
                  </form>
                </Disclosure>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
