import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import {
  createFooterLink,
  deleteFooterLink,
  moveFooterLink,
  updateFooterCopyright,
  updateFooterLink,
} from "./actions";

export const metadata: Metadata = {
  title: "Pied de page — Admin Blac_Kaleta",
};

export default async function FooterPage() {
  const supabase = await createClient();
  const [{ data: settings }, { data: links, error }] = await Promise.all([
    supabase
      .from("settings")
      .select("footer_copyright_text")
      .eq("id", true)
      .maybeSingle(),
    supabase
      .from("footer_links")
      .select("id, label, href, position")
      .order("position", { ascending: true }),
  ]);

  const footerLinks = links ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Pied de page
      </h1>

      <form
        action={updateFooterCopyright}
        className="mt-6 flex flex-wrap items-end gap-3 border border-zinc-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Texte de copyright
          </label>
          <input
            name="footer_copyright_text"
            defaultValue={settings?.footer_copyright_text ?? "© Blac_Kaleta"}
            required
            className="min-w-[280px] border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
          />
        </div>
        <SubmitButton
          pendingText="Enregistrement…"
          className="bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Enregistrer
        </SubmitButton>
      </form>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Liens complémentaires
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        Le lien &laquo;&nbsp;Tableau de bord admin&nbsp;&raquo; reste toujours
        affiché en plus de ceux-ci.
      </p>

      {error ? (
        <p className="mt-4 text-sm text-red-600">
          Erreur de chargement : {error.message}
        </p>
      ) : null}

      <form action={createFooterLink} className="mt-4 flex flex-wrap gap-2">
        <input
          name="label"
          placeholder="Libellé (ex: Mentions légales)"
          required
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
        <input
          name="href"
          placeholder="Lien (ex: /mentions-legales)"
          required
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
        <SubmitButton
          pendingText="Ajout…"
          className="bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          + Ajouter
        </SubmitButton>
      </form>

      {footerLinks.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucun lien complémentaire.</p>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-100">
          {footerLinks.map((link, index) => (
            <li key={link.id} className="flex flex-wrap items-center gap-3 py-3">
              <form
                action={updateFooterLink.bind(null, link.id)}
                className="flex flex-1 flex-wrap items-center gap-3"
              >
                <div className="flex flex-col">
                  <SubmitButton
                    formAction={moveFooterLink.bind(null, link.id, "up")}
                    disabled={index === 0}
                    aria-label="Monter"
                    className="text-xs text-zinc-500 hover:text-black disabled:opacity-20"
                  >
                    ▲
                  </SubmitButton>
                  <SubmitButton
                    formAction={moveFooterLink.bind(null, link.id, "down")}
                    disabled={index === footerLinks.length - 1}
                    aria-label="Descendre"
                    className="text-xs text-zinc-500 hover:text-black disabled:opacity-20"
                  >
                    ▼
                  </SubmitButton>
                </div>
                <input
                  name="label"
                  defaultValue={link.label}
                  className="flex-1 max-w-[220px] border border-transparent px-2 py-1 text-sm hover:border-zinc-300 focus:border-black focus:outline-none"
                />
                <input
                  name="href"
                  defaultValue={link.href}
                  className="flex-1 max-w-[220px] border border-transparent px-2 py-1 text-sm text-zinc-600 hover:border-zinc-300 focus:border-black focus:outline-none"
                />
                <SubmitButton
                  pendingText="Enregistrement…"
                  className="text-sm text-zinc-600 hover:underline"
                >
                  Enregistrer
                </SubmitButton>
                <SubmitButton
                  formAction={deleteFooterLink.bind(null, link.id)}
                  pendingText="Suppression…"
                  className="text-sm text-red-600 hover:underline"
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
