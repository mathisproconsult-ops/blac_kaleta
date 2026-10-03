-- product_images n'a jamais eu de policy RLS pour UPDATE (seulement
-- select/insert/delete, voir 0002_products.sql) : aucun code n'avait eu
-- besoin de modifier une ligne existante jusqu'à l'outil de régénération du
-- filigrane. Résultat : chaque régénération uploadait bien le nouveau
-- fichier filigrané dans Storage, mais la mise à jour de la ligne
-- product_images (path/url) vers ce nouveau fichier était silencieusement
-- bloquée par RLS — sans erreur côté Supabase JS (un update() qui ne
-- correspond à aucune ligne autorisée ne renvoie pas d'erreur), donc
-- invisible dans l'outil, qui rapportait "terminé" alors que la base (et
-- donc le site public) continuait de pointer vers l'ancien fichier.
create policy "product_images_update_authenticated" on public.product_images
  for update to authenticated using (true);
