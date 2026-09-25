import type { Metadata } from "next";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Disclosure } from "@/components/disclosure";
import { createClient } from "@/lib/supabase/server";
import { PopupFormFields } from "./popup-fields";
import {
  createPopup,
  deletePopup,
  movePopup,
  togglePopupActive,
  updatePopup,
} from "./actions";

export const metadata: Metadata = {
  title: "Popups — Admin Blac_Kaleta",
};

type Popup = {
  id: number;
  title: string;
  body: string;
  button_text: string | null;
  button_url: string | null;
  scope: "all" | "home" | "page";
  scope_page_path: string | null;
  frequency: "once" | "every_session";
  is_active: boolean;
  image_url: string | null;
  position: number;
};

const SCOPE_LABELS: Record<Popup["scope"], string> = {
  all: "Toutes les pages",
  home: "Accueil uniquement",
  page: "Page précise",
};

const FREQUENCY_LABELS: Record<Popup["frequency"], string> = {
  once: "Une seule fois par visiteur",
  every_session: "À chaque nouvelle session",
};

export default async function PopupsPage() {
  const supabase = await createClient();
  const { data: popups, error } = await supabase
    .from("popups")
    .select(
      "id, title, body, button_text, button_url, scope, scope_page_path, frequency, is_active, image_url, position",
    )
    .order("position", { ascending: true })
    .returns<Popup[]>();

  const list = popups ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">Popups</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Popups affichées sur le site public — titre, texte, image et bouton optionnels, où et
        quand elles apparaissent, activables/désactivables sans les supprimer.
      </p>

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">
          Erreur de chargement : {error.message}
        </p>
      ) : null}

      <Disclosure label="+ Créer une popup" closeLabel="Annuler" className="mt-6">
        <form
          action={createPopup}
          className="flex flex-col gap-4 border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <PopupFormFields />
          <SubmitButton
            pendingText="Création…"
            className="self-start bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Créer la popup
          </SubmitButton>
        </form>
      </Disclosure>

      {list.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucune popup pour l&apos;instant.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {list.map((popup, index) => (
            <li key={popup.id} className="border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col">
                  <SubmitButton
                    formAction={movePopup.bind(null, popup.id, "up")}
                    disabled={index === 0}
                    aria-label="Monter"
                    className="text-xs text-zinc-500 hover:text-black disabled:opacity-20 dark:hover:text-zinc-100"
                  >
                    ▲
                  </SubmitButton>
                  <SubmitButton
                    formAction={movePopup.bind(null, popup.id, "down")}
                    disabled={index === list.length - 1}
                    aria-label="Descendre"
                    className="text-xs text-zinc-500 hover:text-black disabled:opacity-20 dark:hover:text-zinc-100"
                  >
                    ▼
                  </SubmitButton>
                </div>

                {popup.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={popup.image_url} alt="" className="h-12 w-12 flex-none object-cover" />
                ) : null}

                <div className="min-w-[180px] flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {popup.title}
                    <span
                      className={
                        popup.is_active
                          ? "rounded bg-[#eef4ec] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#3a6b3a] dark:bg-[#16241a] dark:text-[#8fd18f]"
                          : "rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      }
                    >
                      {popup.is_active ? "Active" : "Désactivée"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {SCOPE_LABELS[popup.scope]}
                    {popup.scope === "page" && popup.scope_page_path ? ` (${popup.scope_page_path})` : ""}
                    {" — "}
                    {FREQUENCY_LABELS[popup.frequency]}
                  </p>
                </div>

                <form action={togglePopupActive.bind(null, popup.id, popup.is_active)}>
                  <SubmitButton
                    pendingText="…"
                    className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
                  >
                    {popup.is_active ? "Désactiver" : "Activer"}
                  </SubmitButton>
                </form>

                <form action={deletePopup.bind(null, popup.id)}>
                  <ConfirmSubmitButton
                    confirmMessage="Es-tu sûr de vouloir supprimer cette popup ? Cette action est irréversible."
                    pendingText="Suppression…"
                    className="text-sm text-red-600 hover:underline dark:text-red-400"
                  >
                    Supprimer
                  </ConfirmSubmitButton>
                </form>
              </div>

              <Disclosure label="Modifier" closeLabel="Fermer" className="mt-3">
                <form
                  action={updatePopup.bind(null, popup.id)}
                  className="flex flex-col gap-4 border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <PopupFormFields
                    defaultValues={{
                      title: popup.title,
                      body: popup.body,
                      button_text: popup.button_text,
                      button_url: popup.button_url,
                      scope: popup.scope,
                      scope_page_path: popup.scope_page_path,
                      frequency: popup.frequency,
                      is_active: popup.is_active,
                      image_url: popup.image_url,
                    }}
                  />
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
