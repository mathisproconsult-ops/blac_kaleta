-- Copie haute qualité réservée à la fiche produit et à la lightbox (voir
-- plan "qualité d'image" du chantier) — générée EN PLUS des copies
-- existantes (vignette, principale), jamais à leur place : les grilles
-- continuent d'utiliser la vignette légère.
alter table public.product_images
  add column if not exists high_quality_path text,
  add column if not exists high_quality_url text,
  add column if not exists high_quality_width integer,
  add column if not exists high_quality_height integer;

alter table public.recent_work_media
  add column if not exists high_quality_path text,
  add column if not exists high_quality_url text,
  add column if not exists high_quality_width integer,
  add column if not exists high_quality_height integer;

-- Réglages de qualité d'image (copie haute qualité) et de filigrane,
-- modifiables depuis Réglages → Qualité des images / Filigrane. Valeurs
-- par défaut = comportement actuel exact (filigrane "Blac_Kaleta" en bas
-- à droite, police Caveat) : rien ne change tant que l'admin ne modifie
-- rien.
alter table public.settings
  add column if not exists image_hq_max_dimension integer not null default 2200,
  add column if not exists image_hq_quality integer not null default 90
    check (image_hq_quality between 1 and 100),
  add column if not exists watermark_enabled boolean not null default true,
  add column if not exists watermark_text text not null default 'Blac_Kaleta',
  add column if not exists watermark_position text not null default 'bas-droite'
    check (watermark_position in ('haut-gauche', 'haut-droite', 'bas-gauche', 'bas-droite', 'centre', 'diagonale')),
  add column if not exists watermark_font text not null default 'caveat'
    check (watermark_font in ('caveat', 'playfair', 'montserrat')),
  -- Taille du texte en pourcentage de la largeur de l'image (et non plus
  -- du plus petit côté) : un même pourcentage donne un rendu cohérent
  -- entre la vignette, la copie principale et la copie haute qualité,
  -- quel que soit leur ratio largeur/hauteur respectif.
  add column if not exists watermark_size_percent numeric not null default 4.5
    check (watermark_size_percent > 0),
  add column if not exists watermark_opacity integer not null default 85
    check (watermark_opacity between 0 and 100),
  add column if not exists watermark_color text not null default 'auto'
    check (watermark_color in ('blanc', 'noir', 'auto'));
