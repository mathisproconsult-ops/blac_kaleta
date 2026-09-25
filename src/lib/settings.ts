import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

export type Settings = {
  shop_name: string;
  contact_email: string;
  header_logo_url: string | null;
  footer_copyright_text: string;
  usd_rate: number;
};

const defaultSettings: Settings = {
  shop_name: "Blac_Kaleta",
  contact_email: "contact@blac-kaleta.com",
  header_logo_url: null,
  footer_copyright_text: "© Blac_Kaleta",
  usd_rate: 610,
};

// Mise en cache entre requêtes (unstable_cache) : les réglages ne changent
// que depuis le dashboard (Réglages), qui invalide explicitement l'étiquette
// "settings" après chaque modification (voir admin/settings/actions.ts et
// admin/footer/actions.ts) — les visiteurs ne voient donc jamais de valeur
// périmée. Client public (pas de cookies) car cette fonction est partagée
// entre toutes les requêtes, pas propre à un visiteur.
const getCachedSettings = unstable_cache(
  async (): Promise<Settings> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("settings")
      .select("shop_name, contact_email, header_logo_url, footer_copyright_text, usd_rate")
      .eq("id", true)
      .maybeSingle();

    return (data as Settings | null) ?? defaultSettings;
  },
  ["settings"],
  { tags: ["settings"] },
);

// Mémorisée en plus pour la durée d'une seule requête (React cache) : le
// layout public ET certaines pages (fiche produit, catégorie boutique,
// contact) appellent chacun getSettings() — sans ce cache, unstable_cache
// serait quand même sollicité deux fois pour un même rendu.
export const getSettings = cache(getCachedSettings);
