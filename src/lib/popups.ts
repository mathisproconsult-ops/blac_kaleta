import { createClient } from "@/lib/supabase/server";

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

// Best-effort : la table peut ne pas encore exister (migration 0037) — dans
// ce cas, aucune popup ne s'affiche plutôt que de faire échouer la page.
export async function getActivePopups(): Promise<ActivePopup[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("popups")
    .select(
      "id, title, body, button_text, button_url, scope, scope_page_path, frequency, image_url",
    )
    .eq("is_active", true)
    .order("position", { ascending: true })
    .returns<ActivePopup[]>();

  return data ?? [];
}
