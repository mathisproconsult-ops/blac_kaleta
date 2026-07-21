-- Médiathèque centralisée : tous les fichiers uploadés (images, gifs,
-- pdf), réutilisables partout. Chaque fichier peut être "réclamé" par
-- une œuvre (product_id) — la case "Œuvres récentes" affichée sur sa
-- vignette est alors le même champ que celui du produit.
create table if not exists public.media (
  id bigint generated always as identity primary key,
  filename text not null,
  path text not null,
  url text not null,
  mime_type text,
  kind text not null default 'other' check (kind in ('image', 'gif', 'pdf', 'other')),
  product_id bigint references public.products(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.media enable row level security;

create policy "media_select_public" on public.media
  for select to anon, authenticated using (true);
create policy "media_insert_authenticated" on public.media
  for insert to authenticated with check (true);
create policy "media_update_authenticated" on public.media
  for update to authenticated using (true);
create policy "media_delete_authenticated" on public.media
  for delete to authenticated using (true);

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "media_bucket_select_public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'media');
create policy "media_bucket_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media');
create policy "media_bucket_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media');

-- Reprend les images de produits déjà existantes dans la Médiathèque,
-- pour qu'elles y apparaissent immédiatement (déjà "réclamées" par
-- leur produit d'origine).
insert into public.media (filename, path, url, kind, product_id, created_at)
select
  regexp_replace(pi.path, '^.*/', ''),
  pi.path,
  pi.url,
  'image',
  pi.product_id,
  pi.created_at
from public.product_images pi
where not exists (
  select 1 from public.media m where m.path = pi.path
);
