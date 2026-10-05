import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

export type WatermarkPosition =
  | "haut-gauche"
  | "haut-droite"
  | "bas-gauche"
  | "bas-droite"
  | "centre"
  | "diagonale";
export type WatermarkFontKey = "caveat" | "playfair" | "montserrat";
export type WatermarkColor = "blanc" | "noir" | "auto";

export type Settings = {
  shop_name: string;
  contact_email: string;
  header_logo_url: string | null;
  footer_copyright_text: string;
  usd_rate: number;
  // Copie haute qualité (fiche produit + lightbox uniquement).
  image_hq_max_dimension: number;
  image_hq_quality: number;
  // Filigrane — voir lib/image-protection.ts.
  watermark_enabled: boolean;
  watermark_text: string;
  watermark_position: WatermarkPosition;
  watermark_font: WatermarkFontKey;
  watermark_size_percent: number;
  watermark_opacity: number;
  watermark_color: WatermarkColor;
};

// Ces valeurs par défaut reproduisent exactement le comportement du
// filigrane avant qu'il ne devienne configurable : un site qui n'a pas
// encore appliqué la migration 0043, ou dont l'admin n'a encore rien
// personnalisé, continue de produire un rendu identique à avant.
const defaultSettings: Settings = {
  shop_name: "Blac_Kaleta",
  contact_email: "contact@blac-kaleta.com",
  header_logo_url: null,
  footer_copyright_text: "© Blac_Kaleta",
  usd_rate: 610,
  image_hq_max_dimension: 2200,
  image_hq_quality: 90,
  watermark_enabled: true,
  watermark_text: "Blac_Kaleta",
  watermark_position: "bas-droite",
  watermark_font: "caveat",
  watermark_size_percent: 4.5,
  watermark_opacity: 85,
  watermark_color: "auto",
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
    const { data: fullData, error } = await supabase
      .from("settings")
      .select(
        "shop_name, contact_email, header_logo_url, footer_copyright_text, usd_rate, " +
          "image_hq_max_dimension, image_hq_quality, watermark_enabled, watermark_text, " +
          "watermark_position, watermark_font, watermark_size_percent, watermark_opacity, watermark_color",
      )
      .eq("id", true)
      .maybeSingle();

    let data: Partial<Settings> | null = fullData as Partial<Settings> | null;

    // Les colonnes ajoutées par la migration 0043 peuvent ne pas encore
    // exister : retombe sur la sélection d'origine plutôt que de casser
    // tout le site public, qui appelle cette fonction sur chaque page.
    if (error) {
      const fallback = await supabase
        .from("settings")
        .select("shop_name, contact_email, header_logo_url, footer_copyright_text, usd_rate")
        .eq("id", true)
        .maybeSingle();
      data = fallback.data as Partial<Settings> | null;
    }

    if (!data) return defaultSettings;
    return { ...defaultSettings, ...data };
  },
  ["settings"],
  { tags: ["settings"] },
);

// Mémorisée en plus pour la durée d'une seule requête (React cache) : le
// layout public ET certaines pages (fiche produit, catégorie boutique,
// contact) appellent chacun getSettings() — sans ce cache, unstable_cache
// serait quand même sollicité deux fois pour un même rendu.
export const getSettings = cache(getCachedSettings);
