import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import { EUR_XOF_RATE } from "@/lib/currency";
import { SOCIAL_PLATFORMS } from "@/lib/social-platforms";
import { updateSettings } from "./actions";
import { deleteSocialLink, moveSocialLink, updateSocialLink } from "./social-actions";
import { SocialLinkForm } from "./social-link-form";

export const metadata: Metadata = {
  title: "Paramètres — Admin Blac_Kaleta",
};

type Settings = {
  shop_name: string;
  contact_email: string;
  header_logo_url: string | null;
  usd_rate: number;
  notify_email_per_order: boolean;
  notify_realtime_popup: boolean;
};

const defaultSettings: Settings = {
  shop_name: "Blac_Kaleta",
  contact_email: "contact@blac-kaleta.com",
  header_logo_url: null,
  usd_rate: 610,
  notify_email_per_order: true,
  notify_realtime_popup: true,
};

type SocialLink = { id: number; platform: string; url: string };

export default async function SettingsPage() {
  const supabase = await createClient();
  const [{ data }, { data: socialLinksData, error: socialLinksError }] = await Promise.all([
    supabase
      .from("settings")
      .select(
        "shop_name, contact_email, header_logo_url, usd_rate, notify_email_per_order, notify_realtime_popup",
      )
      .eq("id", true)
      .maybeSingle(),
    supabase
      .from("social_links")
      .select("id, platform, url")
      .order("position", { ascending: true }),
  ]);

  const settings = (data as Settings | null) ?? defaultSettings;
  const socialLinks = (socialLinksData ?? []) as SocialLink[];

  return (
    <div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Paramètres
      </h1>

      <fieldset className="mt-8 flex max-w-2xl flex-col gap-3">
        <legend className="text-sm font-semibold uppercase tracking-wide">
          Réseaux sociaux
        </legend>
        <p className="text-xs text-zinc-500">
          Ajoute les réseaux que tu veux afficher sur la page d&apos;accueil —
          seuls ceux ajoutés ici apparaissent, dans cet ordre.
        </p>

        <SocialLinkForm />

        {socialLinksError ? (
          <p className="text-sm text-red-600">
            Erreur de chargement : {socialLinksError.message}
          </p>
        ) : null}

        {socialLinks.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucun réseau ajouté pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 border-y border-zinc-100">
            {socialLinks.map((link, index) => (
              <li key={link.id} className="py-3">
                <form
                  action={updateSocialLink.bind(null, link.id)}
                  className="flex flex-wrap items-center gap-2"
                >
                  <div className="flex flex-none flex-col">
                    <SubmitButton
                      formAction={moveSocialLink.bind(null, link.id, "up")}
                      disabled={index === 0}
                      aria-label="Monter"
                      className="text-xs text-zinc-500 hover:text-black disabled:opacity-20"
                    >
                      ▲
                    </SubmitButton>
                    <SubmitButton
                      formAction={moveSocialLink.bind(null, link.id, "down")}
                      disabled={index === socialLinks.length - 1}
                      aria-label="Descendre"
                      className="text-xs text-zinc-500 hover:text-black disabled:opacity-20"
                    >
                      ▼
                    </SubmitButton>
                  </div>
                  <select
                    name="platform"
                    defaultValue={link.platform}
                    className="flex-none border border-zinc-300 px-2 py-2 text-sm focus:border-black focus:outline-none"
                  >
                    {SOCIAL_PLATFORMS.map((platform) => (
                      <option key={platform.key} value={platform.key}>
                        {platform.label}
                      </option>
                    ))}
                  </select>
                  <input
                    name="url"
                    type="url"
                    autoComplete="off"
                    defaultValue={link.url}
                    className="min-w-0 flex-1 border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  />
                  <SubmitButton
                    pendingText="Enregistrement…"
                    className="flex-none text-sm text-zinc-600 hover:underline"
                  >
                    Enregistrer
                  </SubmitButton>
                  <SubmitButton
                    formAction={deleteSocialLink.bind(null, link.id)}
                    pendingText="Suppression…"
                    className="flex-none text-sm text-red-600 hover:underline"
                  >
                    Supprimer
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <form action={updateSettings} className="mt-10 flex max-w-lg flex-col gap-10">
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold uppercase tracking-wide">
            Header
          </legend>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-zinc-500">
              Nom du site
            </label>
            <input
              name="shop_name"
              defaultValue={settings.shop_name}
              required
              className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-zinc-500">
              Email de contact
            </label>
            <input
              name="contact_email"
              type="email"
              defaultValue={settings.contact_email}
              required
              className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wide text-zinc-500">
              Logo (remplace le nom du site s&apos;il est renseigné)
            </label>
            {settings.header_logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.header_logo_url}
                alt="Logo actuel"
                className="h-12 w-auto object-contain"
              />
            ) : null}
            <input type="file" name="logo" accept="image/*" className="text-sm" />
            {settings.header_logo_url ? (
              <label className="flex items-center gap-2 text-sm text-red-600">
                <input type="checkbox" name="remove_logo" />
                Supprimer le logo actuel
              </label>
            ) : null}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold uppercase tracking-wide">
            Conversions indicatives (FCFA → EUR / USD)
          </legend>
          <p className="text-xs text-zinc-500">
            Affichées en petit texte gris sous le prix principal en FCFA, sur
            la fiche produit et dans la grille Boutique. Le paiement reste
            toujours en FCFA — ces conversions sont juste indicatives.
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-zinc-500">
              Taux EUR (fixe, légal — ne change jamais)
            </label>
            <input
              disabled
              value={`1 € = ${EUR_XOF_RATE} FCFA`}
              className="border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-zinc-500">
              Taux USD (nombre de FCFA pour 1 $, à mettre à jour toi-même)
            </label>
            <input
              name="usd_rate"
              type="number"
              min="1"
              step="0.01"
              defaultValue={settings.usd_rate}
              required
              className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
            />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold uppercase tracking-wide">
            Notifications
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="notify_email_per_order"
              defaultChecked={settings.notify_email_per_order}
            />
            Recevoir un email à chaque nouvelle commande
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="notify_realtime_popup"
              defaultChecked={settings.notify_realtime_popup}
            />
            Afficher une notification dans le dashboard
          </label>
        </fieldset>

        <SubmitButton
          pendingText="Enregistrement…"
          className="self-start bg-black px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Enregistrer
        </SubmitButton>
      </form>
    </div>
  );
}
