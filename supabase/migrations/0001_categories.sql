-- Table des catégories de produits
create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text not null check (char_length(trim(name)) > 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

-- Lecture publique (nécessaire pour les filtres de la boutique côté site public)
create policy "categories_select_public"
  on public.categories for select
  to anon, authenticated
  using (true);

-- Écriture réservée aux utilisateurs connectés (admin)
create policy "categories_insert_authenticated"
  on public.categories for insert
  to authenticated
  with check (true);

create policy "categories_update_authenticated"
  on public.categories for update
  to authenticated
  using (true);

create policy "categories_delete_authenticated"
  on public.categories for delete
  to authenticated
  using (true);
