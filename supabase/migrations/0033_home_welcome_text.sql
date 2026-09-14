-- Phrase d'accueil affichée sur la page d'accueil publique, au-dessus de la
-- bande d'images défilante. Éditable depuis le dashboard admin
-- (Réglages → Contenu des pages) sans repasser par le code.

alter table public.settings
  add column if not exists home_welcome_text text;

update public.settings
set home_welcome_text = 'Bienvenue dans mon univers. Ici, chaque trait, chaque image, chaque couleur porte un morceau de moi.'
where id = true and home_welcome_text is null;
