-- Bibliothèque de techniques réutilisables (ex: Fusain, Huile sur toile,
-- Aquarelle...), gérée dans le dashboard exactement comme les catégories
-- (créer, renommer, réordonner, supprimer), puis choisie via liste
-- déroulante sur chaque produit au lieu d'un champ texte libre.
create table if not exists public.techniques (
  id bigint generated always as identity primary key,
  name text not null check (char_length(trim(name)) > 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.techniques enable row level security;

create policy "techniques_select_public" on public.techniques
  for select to anon, authenticated using (true);
create policy "techniques_insert_authenticated" on public.techniques
  for insert to authenticated with check (true);
create policy "techniques_update_authenticated" on public.techniques
  for update to authenticated using (true);
create policy "techniques_delete_authenticated" on public.techniques
  for delete to authenticated using (true);

-- Reprend les valeurs déjà saisies en texte libre sur les produits, pour ne
-- rien perdre de ce que le client avait déjà renseigné.
insert into public.techniques (name, position)
select technique, row_number() over (order by technique) - 1
from (
  select distinct technique
  from public.products
  where technique is not null and char_length(trim(technique)) > 0
) as existing;

alter table public.products
  add column if not exists technique_id bigint references public.techniques(id) on delete set null;

update public.products p
set technique_id = t.id
from public.techniques t
where p.technique = t.name and p.technique_id is null;

alter table public.products
  drop column if exists technique;
