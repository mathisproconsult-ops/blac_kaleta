-- Marquage +18 au niveau d'une œuvre individuelle (produit ou entrée
-- Photo/Vidéo), indépendant de la catégorie qui la contient : l'œuvre reste
-- mélangée dans la grille normale, mais s'affiche floutée avec un badge, et
-- son ouverture en lightbox déclenche une vérification d'âge au clic.

alter table public.products
  add column if not exists age_restricted boolean not null default false,
  add column if not exists image_blurred_path text,
  add column if not exists image_blurred_url text;

alter table public.recent_work_media
  add column if not exists age_restricted boolean not null default false;
