import { createClient } from "@supabase/supabase-js";

// Client à privilèges élevés (clé service_role, contourne les policies
// RLS) — réservé aux opérations où l'accès est déjà validé par
// l'application elle-même plutôt que par une policy, comme la page de
// suivi de commande publique (validée par un jeton secret, pas une
// session) ou la génération d'un lien de téléchargement signé pour un
// livre numérique après vérification manuelle du paiement.
//
// Jamais importé depuis un composant client ni renvoyé au navigateur : la
// clé ne doit exister que dans l'environnement serveur (variable
// SUPABASE_SERVICE_ROLE_KEY, sans préfixe NEXT_PUBLIC_).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
