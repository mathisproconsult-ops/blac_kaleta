-- Corbeille pour la Médiathèque, même logique que pour les produits.
alter table public.media
  add column if not exists deleted_at timestamptz;
