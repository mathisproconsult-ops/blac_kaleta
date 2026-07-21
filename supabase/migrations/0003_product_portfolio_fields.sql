-- Champs utilisés par la page publique "Œuvres récentes" (filtres)
alter table public.products
  add column if not exists year integer,
  add column if not exists series text,
  add column if not exists technique text;
