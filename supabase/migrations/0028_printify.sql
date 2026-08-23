-- Intégration Printify (print-on-demand) : identifiants du compte,
-- traçabilité des produits importés et préparation (sans activation) de la
-- transmission de commande — l'identifiant de variante Printify est posé
-- sur option_choices plutôt que sur products, car un produit synchronisé
-- porte en général plusieurs variantes (taille/couleur), chacune associée à
-- un choix d'option précis.

alter table public.settings
  add column if not exists printify_api_key text,
  add column if not exists printify_shop_id text;

alter table public.products
  add column if not exists source text not null default 'original'
    check (source in ('original', 'printify')),
  add column if not exists printify_product_id text;

create unique index if not exists products_printify_product_id_key
  on public.products (printify_product_id)
  where printify_product_id is not null;

alter table public.option_choices
  add column if not exists printify_variant_id text;

-- Colonnes de suivi pour la transmission de commande à Printify — posées
-- maintenant pour ne pas re-migrer plus tard, mais non exploitées tant
-- qu'aucun prestataire de paiement n'est branché (voir brief : seule
-- l'architecture est demandée à ce stade).
alter table public.orders
  add column if not exists printify_order_id text,
  add column if not exists printify_status text,
  add column if not exists printify_tracking_number text,
  add column if not exists printify_carrier text;
