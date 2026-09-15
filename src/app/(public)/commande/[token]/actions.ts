"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type DownloadResult = { url: string | null; error: string | null };

// Utilise le client à privilèges élevés : la page de suivi n'est protégée
// par aucune session, seulement par la connaissance du jeton secret de la
// commande — la vérification se fait donc explicitement ici (commande
// trouvée par jeton, paiement vérifié, article bien un livre numérique de
// cette commande) plutôt que par une policy RLS. Le lien renvoyé est signé
// et temporaire (5 minutes) : jamais d'URL permanente vers le fichier.
export async function getDigitalBookDownloadUrl(
  token: string,
  orderItemId: number,
): Promise<DownloadResult> {
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, payment_verified")
    .eq("access_token", token)
    .maybeSingle();

  if (!order) return { url: null, error: "Commande introuvable." };
  if (!order.payment_verified) {
    return { url: null, error: "Le paiement n'a pas encore été vérifié pour cette commande." };
  }

  const { data: item } = await supabase
    .from("order_items")
    .select("id, product_id, order_id")
    .eq("id", orderItemId)
    .maybeSingle();

  if (!item || item.order_id !== order.id || !item.product_id) {
    return { url: null, error: "Article introuvable pour cette commande." };
  }

  const { data: product } = await supabase
    .from("products")
    .select("is_digital_book, digital_file_path")
    .eq("id", item.product_id)
    .maybeSingle();

  if (!product?.is_digital_book || !product.digital_file_path) {
    return { url: null, error: "Ce produit n'est pas un livre numérique disponible au téléchargement." };
  }

  const { data: signed, error } = await supabase.storage
    .from("artwork-originals")
    .createSignedUrl(product.digital_file_path, 300);

  if (error || !signed) {
    console.error("getDigitalBookDownloadUrl", error);
    return { url: null, error: "Impossible de générer le lien de téléchargement, réessaie." };
  }

  return { url: signed.signedUrl, error: null };
}
