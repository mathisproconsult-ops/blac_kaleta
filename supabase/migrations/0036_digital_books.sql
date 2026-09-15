-- Livres numériques (PDF) : upload privé (jamais d'URL publique directe),
-- déblocage manuel par l'admin après vérification du paiement hors-site.
-- Architecture prête pour un futur paiement automatique (CinetPay, FedaPay,
-- Kkiapay...) : un webhook n'aura qu'à cocher payment_verified, sans toucher
-- à la logique de déblocage déjà en place.

alter table public.products
  add column if not exists is_digital_book boolean not null default false,
  add column if not exists digital_file_path text,
  add column if not exists digital_file_name text;

-- Jeton unique par commande pour sa page de suivi publique
-- (/commande/{jeton}) — pas l'ID auto-incrémenté de la commande, qui serait
-- facilement devinable. Généré automatiquement à la création de la ligne.
alter table public.orders
  add column if not exists payment_verified boolean not null default false,
  add column if not exists access_token text default gen_random_uuid()::text;

update public.orders set access_token = gen_random_uuid()::text where access_token is null;

create unique index if not exists orders_access_token_key on public.orders (access_token);
