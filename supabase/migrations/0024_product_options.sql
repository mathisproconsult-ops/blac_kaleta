-- Système d'options génériques et réutilisables sur les produits (tailles,
-- format papier/numérique, encadrement, etc.), pensé pour couvrir tous les
-- besoins actuels et futurs sans coder chaque variante séparément.

-- Un groupe d'options (ex: "Dimensions", "Format") : soit un seul choix à
-- la fois (liste déroulante), soit plusieurs choix cumulables (cases à
-- cocher, prix additionnés) — décidé par le client à la création.
create table if not exists public.option_groups (
  id bigint generated always as identity primary key,
  name text not null check (char_length(trim(name)) > 0),
  selection_type text not null default 'single'
    check (selection_type in ('single', 'multiple')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Un choix dans un groupe (ex: "30x40 cm", +5000 FCFA). "delivery_nature"
-- prépare la livraison automatique de fichiers numériques (pas branchée
-- maintenant, faute de prestataire de paiement) : un choix numérique peut
-- porter un fichier PDF, prêt à être livré automatiquement plus tard sans
-- revoir le modèle de données.
create table if not exists public.option_choices (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.option_groups(id) on delete cascade,
  label text not null check (char_length(trim(label)) > 0),
  price_delta numeric(10, 2) not null default 0,
  delivery_nature text not null default 'physical'
    check (delivery_nature in ('physical', 'digital')),
  digital_file_path text,
  digital_file_url text,
  digital_file_name text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Quels groupes d'options s'appliquent à quel produit (choisi côté fiche
-- produit dans le dashboard).
create table if not exists public.product_option_groups (
  product_id bigint not null references public.products(id) on delete cascade,
  group_id bigint not null references public.option_groups(id) on delete cascade,
  position integer not null default 0,
  primary key (product_id, group_id)
);

alter table public.option_groups enable row level security;
alter table public.option_choices enable row level security;
alter table public.product_option_groups enable row level security;

create policy "option_groups_select_public" on public.option_groups
  for select to anon, authenticated using (true);
create policy "option_groups_insert_authenticated" on public.option_groups
  for insert to authenticated with check (true);
create policy "option_groups_update_authenticated" on public.option_groups
  for update to authenticated using (true);
create policy "option_groups_delete_authenticated" on public.option_groups
  for delete to authenticated using (true);

create policy "option_choices_select_public" on public.option_choices
  for select to anon, authenticated using (true);
create policy "option_choices_insert_authenticated" on public.option_choices
  for insert to authenticated with check (true);
create policy "option_choices_update_authenticated" on public.option_choices
  for update to authenticated using (true);
create policy "option_choices_delete_authenticated" on public.option_choices
  for delete to authenticated using (true);

create policy "product_option_groups_select_public" on public.product_option_groups
  for select to anon, authenticated using (true);
create policy "product_option_groups_insert_authenticated" on public.product_option_groups
  for insert to authenticated with check (true);
create policy "product_option_groups_delete_authenticated" on public.product_option_groups
  for delete to authenticated using (true);

-- Cliché des options choisies au moment de la commande (même logique que
-- product_title / unit_price déjà dénormalisés sur order_items : la
-- commande reste lisible même si le produit ou ses options changent après).
alter table public.order_items
  add column if not exists selected_options jsonb;
