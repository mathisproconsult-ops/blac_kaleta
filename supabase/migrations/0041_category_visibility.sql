-- Permet de masquer une catégorie du site public (Boutique ou Œuvres
-- récentes) sans la supprimer : son contenu (produits, photos, vidéos)
-- reste intact et modifiable depuis le dashboard, juste retiré de la
-- navigation publique tant qu'elle est masquée.

alter table public.categories
  add column if not exists is_visible boolean not null default true;

alter table public.recent_work_categories
  add column if not exists is_visible boolean not null default true;
