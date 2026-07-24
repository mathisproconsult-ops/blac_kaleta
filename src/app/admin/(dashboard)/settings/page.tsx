import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import { CURRENCY_LABELS, EUR_XOF_RATE, type CurrencyCode } from "@/lib/currency";
import { updateSettings } from "./actions";

export const metadata: Metadata = {
  title: "Paramètres — Admin Blac_Kaleta",
};

type Settings = {
  shop_name: string;
  contact_email: string;
  header_logo_url: string | null;
  currency: CurrencyCode;
  usd_rate: number;
  payment_kkiapay: boolean;
  payment_fedapay: boolean;
  notify_email_per_order: boolean;
  notify_realtime_popup: boolean;
  social_instagram: string | null;
  social_facebook: string | null;
  social_whatsapp: string | null;
  social_youtube: string | null;
  social_tiktok: string | null;
  social_patreon: string | null;
};

const defaultSettings: Settings = {
  shop_name: "Blac_Kaleta",
  contact_email: "contact@blac-kaleta.com",
  header_logo_url: null,
  currency: "EUR",
  usd_rate: 610,
  payment_kkiapay: false,
  payment_fedapay: false,
  notify_email_per_order: true,
  notify_realtime_popup: true,
  social_instagram: null,
  social_facebook: null,
  social_whatsapp: null,
  social_youtube: null,
  social_tiktok: null,
  social_patreon: null,
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select(
      "shop_name, contact_email, header_logo_url, currency, usd_rate, payment_kkiapay, payment_fedapay, notify_email_per_order, notify_realtime_popup, social_instagram, social_facebook, social_whatsapp, social_youtube, social_tiktok, social_patreon",
    )
    .eq("id", true)
    .maybeSingle();

  const settings = (data as Settings | null) ?? defaultSettings;

  return (
    <div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Paramètres
      </h1>

      <form action={updateSettings} className="mt-8 flex max-w-lg flex-col gap-10">
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
            Devise
          </legend>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-zinc-500">
              Devise utilisée pour les prix (dashboard + site public)
            </label>
            <select
              name="currency"
              defaultValue={settings.currency}
              className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
            >
              {Object.entries(CURRENCY_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
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
            Moyens de paiement
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="payment_kkiapay"
              defaultChecked={settings.payment_kkiapay}
            />
            Kkiapay (Mobile Money)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="payment_fedapay"
              defaultChecked={settings.payment_fedapay}
            />
            FedaPay (Mobile Money)
          </label>
          <p className="text-xs text-zinc-500">
            L&apos;intégration technique de ces moyens de paiement sera
            branchée dans une prochaine étape.
          </p>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold uppercase tracking-wide">
            Réseaux sociaux
          </legend>
          <p className="text-xs text-zinc-500">
            Laisse un champ vide pour ne pas afficher son icône sur la page
            d&apos;accueil.
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-zinc-500">
              Instagram
            </label>
            <input
              name="social_instagram"
              defaultValue={settings.social_instagram ?? ""}
              placeholder="https://instagram.com/..."
              className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-zinc-500">
              Facebook
            </label>
            <input
              name="social_facebook"
              defaultValue={settings.social_facebook ?? ""}
              placeholder="https://facebook.com/..."
              className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-zinc-500">
              WhatsApp
            </label>
            <input
              name="social_whatsapp"
              defaultValue={settings.social_whatsapp ?? ""}
              placeholder="https://wa.me/..."
              className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-zinc-500">
              YouTube
            </label>
            <input
              name="social_youtube"
              defaultValue={settings.social_youtube ?? ""}
              placeholder="https://youtube.com/..."
              className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-zinc-500">
              TikTok
            </label>
            <input
              name="social_tiktok"
              defaultValue={settings.social_tiktok ?? ""}
              placeholder="https://tiktok.com/@..."
              className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-zinc-500">
              Patreon
            </label>
            <input
              name="social_patreon"
              defaultValue={settings.social_patreon ?? ""}
              placeholder="https://patreon.com/..."
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
