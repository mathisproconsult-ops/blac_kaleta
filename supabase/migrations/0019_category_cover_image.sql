-- Image de couverture par catégorie, affichée sur la page Boutique (niveau 1).
alter table public.categories
  add column if not exists cover_image_url text,
  add column if not exists cover_image_path text;
