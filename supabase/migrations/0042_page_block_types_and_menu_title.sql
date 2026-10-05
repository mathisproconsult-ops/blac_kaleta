-- Deux nouveaux types de bloc pour l'éditeur de contenu de page :
-- accordéon/FAQ et liste à puces (voir lib/page-blocks.ts).
alter table public.page_blocks drop constraint if exists page_blocks_type_check;
alter table public.page_blocks add constraint page_blocks_type_check
  check (type in ('titre', 'texte', 'image', 'accordeon', 'liste'));

-- Titre de menu distinct du titre de page (ex: "Charte de confidentialité
-- et modalités d'utilisation des cookies" en titre de page, "Cookies" dans
-- le menu) — vide par défaut, auquel cas le titre de page continue de
-- servir de libellé de menu comme avant.
alter table public.pages add column if not exists menu_title text;
