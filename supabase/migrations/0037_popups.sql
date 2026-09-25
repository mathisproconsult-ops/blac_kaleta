-- Système générique de popups gérées depuis le dashboard (Réglages →
-- Popups), pour ne plus avoir à coder une popup "en dur" à chaque besoin.

create table if not exists public.popups (
  id bigint generated always as identity primary key,
  title text not null check (char_length(trim(title)) > 0),
  body text not null check (char_length(trim(body)) > 0),
  image_url text,
  image_path text,
  button_text text,
  button_url text,
  -- 'all' : toutes les pages publiques ; 'home' : accueil uniquement ;
  -- 'page' : un chemin précis (scope_page_path), ex. "/boutique".
  scope text not null default 'all' check (scope in ('all', 'home', 'page')),
  scope_page_path text,
  -- 'once' : mémorisée en localStorage, ne réapparaît plus jamais une fois
  -- vue ; 'every_session' : mémorisée en sessionStorage, réapparaît à
  -- chaque nouvelle session de navigation.
  frequency text not null default 'once' check (frequency in ('once', 'every_session')),
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.popups enable row level security;

create policy "popups_select_public" on public.popups
  for select to anon, authenticated using (true);
create policy "popups_insert_authenticated" on public.popups
  for insert to authenticated with check (true);
create policy "popups_update_authenticated" on public.popups
  for update to authenticated using (true);
create policy "popups_delete_authenticated" on public.popups
  for delete to authenticated using (true);

-- Première popup demandée : message de bienvenue, page d'accueil, une
-- seule fois par visiteur.
insert into public.popups (title, body, scope, frequency, is_active, position)
select
  'Bienvenue',
  'Bienvenue dans mon univers. Ici, chaque trait, chaque image, chaque couleur porte un morceau de moi.',
  'home',
  'once',
  true,
  0
where not exists (select 1 from public.popups);
