-- Restructure "Œuvres récentes" sur le même principe que la Boutique :
-- niveau 1 = catégories cliquables (Œuvres, Photo, Vidéo...), niveau 2 =
-- galerie filtrée. Les "Œuvres" restent des produits (show_in_recent_works,
-- déjà existant) simplement rattachés à l'une de ces catégories ; Photo et
-- Vidéo sont des entrées indépendantes du catalogue produits.

create table if not exists public.recent_work_categories (
  id bigint generated always as identity primary key,
  name text not null check (char_length(trim(name)) > 0),
  position integer not null default 0,
  cover_image_url text,
  cover_image_path text,
  created_at timestamptz not null default now()
);

alter table public.recent_work_categories enable row level security;

create policy "recent_work_categories_select_public" on public.recent_work_categories
  for select to anon, authenticated using (true);
create policy "recent_work_categories_insert_authenticated" on public.recent_work_categories
  for insert to authenticated with check (true);
create policy "recent_work_categories_update_authenticated" on public.recent_work_categories
  for update to authenticated using (true);
create policy "recent_work_categories_delete_authenticated" on public.recent_work_categories
  for delete to authenticated using (true);

alter table public.products
  add column if not exists recent_work_category_id bigint
    references public.recent_work_categories(id) on delete set null;

-- Catégorie "Œuvres" créée automatiquement pour ne rien casser : les
-- produits déjà marqués "Afficher dans Œuvres récentes" y sont rattachés
-- sans action de l'admin.
insert into public.recent_work_categories (name, position)
select 'Œuvres', 0
where not exists (select 1 from public.recent_work_categories);

update public.products p
set recent_work_category_id = (
  select id from public.recent_work_categories order by position limit 1
)
where p.show_in_recent_works = true and p.recent_work_category_id is null;

-- Entrées Photo / Vidéo, indépendantes du catalogue produits — une vidéo
-- soit uploadée directement (video_path/video_url), soit en lien externe
-- YouTube/Vimeo (video_provider + video_external_url), avec dans les deux
-- cas une vignette (image_path/image_url) affichée dans la galerie.
create table if not exists public.recent_work_media (
  id bigint generated always as identity primary key,
  recent_work_category_id bigint not null
    references public.recent_work_categories(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  year integer,
  technique_id bigint references public.techniques(id) on delete set null,
  kind text not null check (kind in ('photo', 'video')),
  image_path text,
  image_url text,
  video_path text,
  video_url text,
  video_provider text check (video_provider in ('youtube', 'vimeo') or video_provider is null),
  video_external_url text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.recent_work_media enable row level security;

create policy "recent_work_media_select_public" on public.recent_work_media
  for select to anon, authenticated using (true);
create policy "recent_work_media_insert_authenticated" on public.recent_work_media
  for insert to authenticated with check (true);
create policy "recent_work_media_update_authenticated" on public.recent_work_media
  for update to authenticated using (true);
create policy "recent_work_media_delete_authenticated" on public.recent_work_media
  for delete to authenticated using (true);
