-- Protection des œuvres : bucket privé pour les originaux non filigranés
-- (jamais exposé publiquement — lecture réservée à l'admin connecté), et
-- trace du chemin de l'original correspondant à chaque photo publiée.
-- Les photos publiques continuent de vivre dans le bucket "products"
-- (déjà public, voir migration 0002), mais désormais avec la copie
-- redimensionnée + filigranée plutôt que l'original brut.

insert into storage.buckets (id, name, public)
values ('artwork-originals', 'artwork-originals', false)
on conflict (id) do nothing;

create policy "artwork_originals_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'artwork-originals');

create policy "artwork_originals_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'artwork-originals');

create policy "artwork_originals_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'artwork-originals');

alter table public.product_images
  add column if not exists original_path text;
