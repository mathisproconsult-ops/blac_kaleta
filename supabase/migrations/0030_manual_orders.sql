-- Création manuelle de clients et de commandes depuis le dashboard (ventes
-- hors-site : en personne, par message...), pour garder une comptabilité
-- complète même quand la vente ne passe pas par le site public.
--
-- Il n'existait auparavant aucune table "clients" : un client était une
-- simple agrégation de ses commandes par email. On introduit maintenant une
-- vraie table, mais SANS toucher au tunnel d'achat public — les commandes
-- en ligne continuent d'enregistrer juste customer_name/email/phone comme
-- avant, sans customer_id. Le dashboard sait recouper les deux (voir
-- src/app/admin/(dashboard)/customers/get-customers.ts).

create table if not exists public.customers (
  id bigint generated always as identity primary key,
  name text not null check (char_length(trim(name)) > 0),
  email text,
  phone text,
  created_at timestamptz not null default now()
);

-- Email unique quand renseigné (vente en espèces sans email autorisée,
-- donc pas de contrainte "not null" ni d'unicité globale).
create unique index if not exists customers_email_key
  on public.customers (lower(email))
  where email is not null;

alter table public.customers enable row level security;

create policy "customers_select_authenticated" on public.customers
  for select to authenticated using (true);
create policy "customers_insert_authenticated" on public.customers
  for insert to authenticated with check (true);
create policy "customers_update_authenticated" on public.customers
  for update to authenticated using (true);
create policy "customers_delete_authenticated" on public.customers
  for delete to authenticated using (true);

alter table public.orders
  add column if not exists customer_id bigint references public.customers(id) on delete cascade,
  add column if not exists source text not null default 'online'
    check (source in ('online', 'manual')),
  add column if not exists note text;
