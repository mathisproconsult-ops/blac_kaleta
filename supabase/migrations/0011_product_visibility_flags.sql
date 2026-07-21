-- Une œuvre n'est pas forcément à vendre, et une œuvre à vendre n'est
-- pas forcément dans le portfolio "Œuvres récentes" : ce sont deux
-- listes indépendantes, contrôlées par des cases dédiées.
alter table public.products
  add column if not exists is_for_sale boolean not null default false,
  add column if not exists show_in_recent_works boolean not null default false,
  add column if not exists featured_home boolean not null default false;

-- Reprend le comportement actuel (prix renseigné = en vente,
-- année renseignée = visible dans Œuvres récentes) pour ne rien
-- changer visuellement tant que l'admin n'a pas encore touché aux
-- nouvelles cases.
update public.products set is_for_sale = true where price is not null;
update public.products set show_in_recent_works = true where year is not null;
