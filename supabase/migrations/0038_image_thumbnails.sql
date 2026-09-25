-- Vignettes de grille, distinctes de l'image pleine résolution : les
-- grilles (Boutique, Œuvres récentes) affichaient jusqu'ici la même image
-- que la vue détaillée/agrandie (jusqu'à 1200px), alors qu'une vignette ne
-- fait que quelques centaines de pixels de large à l'écran.

alter table public.product_images
  add column if not exists thumbnail_path text,
  add column if not exists thumbnail_url text;

alter table public.recent_work_media
  add column if not exists thumbnail_path text,
  add column if not exists thumbnail_url text;
