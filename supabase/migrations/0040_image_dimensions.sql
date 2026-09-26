-- Dimensions réelles de chaque image de produit (largeur/hauteur en
-- pixels de la copie publique protégée) : permettent au navigateur de
-- réserver le bon espace avant même que l'image ne soit chargée, pour
-- éviter un décalage visuel (CLS) — en particulier dans la bannière
-- défilante de la page d'accueil, où chaque vignette a une largeur
-- intrinsèque différente selon le format de l'œuvre.

alter table public.product_images
  add column if not exists width integer,
  add column if not exists height integer;
