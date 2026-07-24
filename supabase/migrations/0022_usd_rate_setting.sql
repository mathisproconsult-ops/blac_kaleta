-- Taux FCFA -> USD, mis à jour manuellement par le client (pas d'API).
-- Le taux FCFA -> EUR est fixe (655,957) et géré côté code, pas besoin
-- de colonne pour lui.
alter table public.settings
  add column if not exists usd_rate numeric(10, 2) not null default 610;
