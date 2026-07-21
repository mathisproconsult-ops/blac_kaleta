-- Table des produits (œuvres)
create table if not exists public.products (
  id bigint generated always as identity primary key,
  title text not null check (char_length(trim(title)) > 0),
  price numeric(10, 2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  status text not null default 'available'
    check (status in ('available', 'out_of_stock', 'reserved', 'sold')),
  description text,
  created_at timestamptz not null default now()
);

-- Association produit <-> catégories (plusieurs catégories par produit)
create table if not exists public.product_categories (
  product_id bigint not null references public.products(id) on delete cascade,
  category_id bigint not null references public.categories(id) on delete cascade,
  primary key (product_id, category_id)
);

-- Images d'un produit (galerie), ordonnées par position (0 = image principale)
create table if not exists public.product_images (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  path text not null,
  url text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_images enable row level security;

create policy "products_select_public" on public.products
  for select to anon, authenticated using (true);
create policy "products_insert_authenticated" on public.products
  for insert to authenticated with check (true);
create policy "products_update_authenticated" on public.products
  for update to authenticated using (true);
create policy "products_delete_authenticated" on public.products
  for delete to authenticated using (true);

create policy "product_categories_select_public" on public.product_categories
  for select to anon, authenticated using (true);
create policy "product_categories_insert_authenticated" on public.product_categories
  for insert to authenticated with check (true);
create policy "product_categories_delete_authenticated" on public.product_categories
  for delete to authenticated using (true);

create policy "product_images_select_public" on public.product_images
  for select to anon, authenticated using (true);
create policy "product_images_insert_authenticated" on public.product_images
  for insert to authenticated with check (true);
create policy "product_images_delete_authenticated" on public.product_images
  for delete to authenticated using (true);

-- Bucket de stockage pour les photos des œuvres (public en lecture)
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;

create policy "product_images_bucket_select_public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'products');

create policy "product_images_bucket_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'products');

create policy "product_images_bucket_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'products');
