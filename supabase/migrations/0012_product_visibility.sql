-- Masquer une œuvre sans la supprimer : elle disparaît de tout le site
-- public (Boutique, Œuvres récentes, mise en avant) mais reste dans le
-- dashboard avec toutes ses informations et cases conservées.
alter table public.products
  add column if not exists is_visible boolean not null default true;
