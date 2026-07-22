-- L'ancien déclencheur marquait "reserved" TOUT produit dès qu'une commande
-- le touchait, même les tirages en plusieurs exemplaires (stock > 1) — ce qui
-- masquait les boutons d'achat pour le reste du stock. La disponibilité est
-- désormais gérée côté application (panier + commande), stock par stock.
drop trigger if exists order_items_mark_reserved on public.order_items;
drop function if exists public.mark_product_reserved();

-- Répare les produits restés bloqués à "reserved" par ce déclencheur alors
-- qu'il reste du stock disponible pour les vendre.
update public.products
set status = 'available'
where status = 'reserved' and stock > 0;
