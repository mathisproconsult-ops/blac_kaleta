create table if not exists public.menu_items (
  id bigint generated always as identity primary key,
  label text not null check (char_length(trim(label)) > 0),
  href text not null check (char_length(trim(href)) > 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.menu_items enable row level security;

-- Le menu est affiché sur toutes les pages publiques.
create policy "menu_items_select_public" on public.menu_items
  for select to anon, authenticated using (true);
create policy "menu_items_insert_authenticated" on public.menu_items
  for insert to authenticated with check (true);
create policy "menu_items_update_authenticated" on public.menu_items
  for update to authenticated using (true);
create policy "menu_items_delete_authenticated" on public.menu_items
  for delete to authenticated using (true);

insert into public.menu_items (label, href, position)
select * from (values
  ('Accueil', '/', 0),
  ('À propos', '/a-propos', 1),
  ('Œuvres récentes', '/oeuvres-recentes', 2),
  ('Boutique', '/boutique', 3),
  ('Contact', '/contact', 4)
) as seed(label, href, position)
where not exists (select 1 from public.menu_items);
