import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Client anonyme, sans lecture de cookies : contrairement à
// lib/supabase/server.ts (qui appelle cookies() et rend donc toute la page
// dynamique), celui-ci peut être utilisé à l'intérieur d'une fonction
// enveloppée par unstable_cache. Réservé aux lectures publiques (réglages,
// popups, menu, pied de page, catalogue) — jamais pour du contenu propre à
// un visiteur (panier, session admin, etc.).
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}
