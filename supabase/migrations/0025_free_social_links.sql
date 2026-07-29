-- Remplace les 6 champs fixes (Instagram, Facebook, WhatsApp, YouTube,
-- TikTok, Patreon) sur settings par une liste libre : le client choisit la
-- plateforme dans une liste et colle son lien, réordonnable, supprimable.
create table if not exists public.social_links (
  id bigint generated always as identity primary key,
  platform text not null check (platform in (
    'instagram', 'tiktok', 'youtube', 'facebook', 'whatsapp', 'patreon',
    'x', 'pinterest', 'behance', 'linkedin'
  )),
  url text not null check (char_length(trim(url)) > 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.social_links enable row level security;

-- Affichée sur la page d'accueil publique : lecture ouverte à "anon".
create policy "social_links_select_public" on public.social_links
  for select to anon, authenticated using (true);
create policy "social_links_insert_authenticated" on public.social_links
  for insert to authenticated with check (true);
create policy "social_links_update_authenticated" on public.social_links
  for update to authenticated using (true);
create policy "social_links_delete_authenticated" on public.social_links
  for delete to authenticated using (true);

-- Reprend les liens déjà renseignés dans les anciens champs fixes, pour ne
-- pas perdre ce que le client avait déjà configuré.
insert into public.social_links (platform, url, position)
select platform, url, position
from (
  values
    ('instagram', (select social_instagram from public.settings where id = true), 0),
    ('facebook', (select social_facebook from public.settings where id = true), 1),
    ('whatsapp', (select social_whatsapp from public.settings where id = true), 2),
    ('youtube', (select social_youtube from public.settings where id = true), 3),
    ('tiktok', (select social_tiktok from public.settings where id = true), 4),
    ('patreon', (select social_patreon from public.settings where id = true), 5)
) as old(platform, url, position)
where old.url is not null and char_length(trim(old.url)) > 0;

alter table public.settings
  drop column if exists social_instagram,
  drop column if exists social_facebook,
  drop column if exists social_whatsapp,
  drop column if exists social_youtube,
  drop column if exists social_tiktok,
  drop column if exists social_patreon;
