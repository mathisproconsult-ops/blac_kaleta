-- Corbeille : masquer un produit sans le supprimer définitivement.
alter table public.products
  add column if not exists deleted_at timestamptz;
