-- Devise utilisée pour l'affichage des prix (dashboard + site public)
alter table public.settings
  add column if not exists currency text not null default 'EUR';
