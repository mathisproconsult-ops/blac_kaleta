import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

export type ActivePopup = {
  id: number;
  title: string;
  body: string;
  button_text: string | null;
  button_url: string | null;
  scope: "all" | "home" | "page";
  scope_page_path: string | null;
  frequency: "once" | "every_session";
  image_url: string | null;
};

// Mise en cache entre requêtes : le dashboard Popups invalide explicitement
// l'étiquette "popups" à chaque création/modification/suppression/activation
// (voir admin/popups/actions.ts) — jamais de popup périmée affichée aux
// visiteurs. Best-effort : la table peut ne pas encore exister (migration
// 0037) — dans ce cas, aucune popup ne s'affiche plutôt que de faire
// échouer la page.
export const getActivePopups = unstable_cache(
  async (): Promise<ActivePopup[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("popups")
      .select(
        "id, title, body, button_text, button_url, scope, scope_page_path, frequency, image_url",
      )
      .eq("is_active", true)
      .order("position", { ascending: true })
      .returns<ActivePopup[]>();

    return data ?? [];
  },
  ["popups"],
  { tags: ["popups"] },
);
