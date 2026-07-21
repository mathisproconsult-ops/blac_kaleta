-- Éditeur de contenu (version simple) : chaque page contient une liste
-- ordonnée de blocs (titre, texte, image) modifiables depuis l'admin.
create table if not exists public.pages (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title text not null
);

create table if not exists public.page_blocks (
  id bigint generated always as identity primary key,
  page_id bigint not null references public.pages(id) on delete cascade,
  type text not null check (type in ('titre', 'texte', 'image')),
  content jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.pages enable row level security;
alter table public.page_blocks enable row level security;

create policy "pages_select_public" on public.pages
  for select to anon, authenticated using (true);

create policy "page_blocks_select_public" on public.page_blocks
  for select to anon, authenticated using (true);
create policy "page_blocks_insert_authenticated" on public.page_blocks
  for insert to authenticated with check (true);
create policy "page_blocks_update_authenticated" on public.page_blocks
  for update to authenticated using (true);
create policy "page_blocks_delete_authenticated" on public.page_blocks
  for delete to authenticated using (true);

insert into public.pages (slug, title) values
  ('home', 'Accueil'),
  ('a-propos', 'À propos')
on conflict (slug) do nothing;

-- Blocs de départ, une seule fois par page (idempotent : basé sur
-- page_id + position, donc sans effet si déjà exécuté)
insert into public.page_blocks (page_id, type, content, position)
select p.id, 'image', '{}'::jsonb, 0
from public.pages p
where p.slug = 'home'
  and not exists (
    select 1 from public.page_blocks pb where pb.page_id = p.id and pb.position = 0
  );

insert into public.page_blocks (page_id, type, content, position)
select p.id, 'image', '{}'::jsonb, 0
from public.pages p
where p.slug = 'a-propos'
  and not exists (
    select 1 from public.page_blocks pb where pb.page_id = p.id and pb.position = 0
  );

insert into public.page_blocks (page_id, type, content, position)
select p.id, 'titre', '{"text": "À propos"}'::jsonb, 1
from public.pages p
where p.slug = 'a-propos'
  and not exists (
    select 1 from public.page_blocks pb where pb.page_id = p.id and pb.position = 1
  );

insert into public.page_blocks (page_id, type, content, position)
select p.id, 'texte',
  '{"text": "Blac_Kaleta est un(e) artiste dont le travail explore la couleur, la matière et le mouvement à travers la peinture et le dessin.\n\n(Texte à remplacer par la vraie biographie de l''artiste.)"}'::jsonb,
  2
from public.pages p
where p.slug = 'a-propos'
  and not exists (
    select 1 from public.page_blocks pb where pb.page_id = p.id and pb.position = 2
  );

-- Bucket de stockage pour les images des blocs de contenu
insert into storage.buckets (id, name, public)
values ('pages', 'pages', true)
on conflict (id) do nothing;

create policy "page_images_bucket_select_public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'pages');

create policy "page_images_bucket_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'pages');

create policy "page_images_bucket_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'pages');
