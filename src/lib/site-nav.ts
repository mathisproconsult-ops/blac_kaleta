import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

export type NavLink = { id: number; label: string; href: string };

// Mise en cache entre requêtes : appelées par le layout public sur CHAQUE
// page du site. Le dashboard Menu / Pied de page invalide explicitement les
// étiquettes correspondantes à chaque modification (voir
// admin/menu/actions.ts et admin/footer/actions.ts).
export const getMenuItems = unstable_cache(
  async (): Promise<NavLink[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("menu_items")
      .select("id, label, href")
      .order("position", { ascending: true });
    return data ?? [];
  },
  ["menu-items"],
  { tags: ["menu"] },
);

export const getFooterLinks = unstable_cache(
  async (): Promise<NavLink[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("footer_links")
      .select("id, label, href")
      .order("position", { ascending: true });
    return data ?? [];
  },
  ["footer-links"],
  { tags: ["footer"] },
);
