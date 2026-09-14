import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import { CreatePageForm } from "./create-page-form";
import { updateHomeWelcomeText } from "./actions";

export const metadata: Metadata = {
  title: "Contenu des pages — Admin Blac_Kaleta",
};

const DEFAULT_WELCOME_TEXT =
  "Bienvenue dans mon univers. Ici, chaque trait, chaque image, chaque couleur porte un morceau de moi.";

export default async function PagesIndex() {
  const supabase = await createClient();
  const [{ data: pages }, { data: settingsData }] = await Promise.all([
    supabase
      .from("pages")
      .select("slug, title, show_in_menu")
      .order("title", { ascending: true }),
    // Requête séparée et best-effort : la colonne peut ne pas encore exister
    // si la migration 0033 n'a pas été appliquée.
    supabase.from("settings").select("home_welcome_text").eq("id", true).maybeSingle(),
  ]);

  const pageList = pages ?? [];
  const homeWelcomeText =
    (settingsData as { home_welcome_text: string | null } | null)?.home_welcome_text ??
    DEFAULT_WELCOME_TEXT;

  return (
    <div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Contenu des pages
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Crée une page ou choisis-en une pour modifier ses blocs (titre,
        texte, image).
      </p>

      <fieldset className="mt-8 flex max-w-xl flex-col gap-2 border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <legend className="px-1 text-sm font-semibold uppercase tracking-wide">
          Page d&apos;accueil — Phrase d&apos;accueil
        </legend>
        <p className="text-xs text-zinc-500">
          Affichée au-dessus de la bande d&apos;images défilante sur la page
          d&apos;accueil du site.
        </p>
        <form action={updateHomeWelcomeText} className="flex flex-col gap-3">
          <textarea
            name="home_welcome_text"
            rows={3}
            defaultValue={homeWelcomeText}
            className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
          <SubmitButton
            pendingText="Enregistrement…"
            className="self-start bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Enregistrer
          </SubmitButton>
        </form>
      </fieldset>

      <div className="mt-8">
        <CreatePageForm />
      </div>

      {pageList.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucune page pour l&apos;instant.</p>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-100 dark:border-zinc-800">
          {pageList.map((page) => (
            <li key={page.slug} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <Link
                href={`/admin/pages/${page.slug}`}
                className="text-sm font-medium hover:underline"
              >
                {page.title}
              </Link>
              <span className="text-xs text-zinc-500">
                /{page.slug} {page.show_in_menu ? "· dans le menu" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
