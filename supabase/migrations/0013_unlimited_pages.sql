-- Pages illimitées : chaque page peut être liée à une entrée de menu.
alter table public.pages
  add column if not exists show_in_menu boolean not null default false;

alter table public.menu_items
  add column if not exists page_id bigint references public.pages(id) on delete cascade;

-- Relie l'entrée de menu "À propos" existante à sa page, pour que la
-- case "Ajouter au menu" fonctionne dès l'édition suivante.
update public.menu_items
set page_id = p.id
from public.pages p
where p.slug = 'a-propos' and menu_items.href = '/a-propos' and menu_items.page_id is null;

update public.pages set show_in_menu = true where slug = 'a-propos';

-- La page "Accueil" n'est plus pilotée par le système de blocs
-- (remplacée par la mise en avant d'œuvres) : on nettoie les blocs
-- inutilisés pour ne pas induire l'admin en erreur.
delete from public.page_blocks
where page_id in (select id from public.pages where slug = 'home');
delete from public.pages where slug = 'home';

-- Header : nom du site déjà dans settings.shop_name ; on ajoute le logo.
alter table public.settings
  add column if not exists header_logo_url text,
  add column if not exists header_logo_path text;

-- Footer : texte de copyright éditable.
alter table public.settings
  add column if not exists footer_copyright_text text
    not null default '© Blac_Kaleta';

-- Liens complémentaires du footer.
create table if not exists public.footer_links (
  id bigint generated always as identity primary key,
  label text not null check (char_length(trim(label)) > 0),
  href text not null check (char_length(trim(href)) > 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.footer_links enable row level security;

create policy "footer_links_select_public" on public.footer_links
  for select to anon, authenticated using (true);
create policy "footer_links_insert_authenticated" on public.footer_links
  for insert to authenticated with check (true);
create policy "footer_links_update_authenticated" on public.footer_links
  for update to authenticated using (true);
create policy "footer_links_delete_authenticated" on public.footer_links
  for delete to authenticated using (true);
