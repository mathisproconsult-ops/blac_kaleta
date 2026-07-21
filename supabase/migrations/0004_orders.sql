-- Commandes
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  shipping_address text,
  status text not null default 'new'
    check (status in ('new', 'preparing', 'shipped', 'delivered')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  product_id bigint references public.products(id) on delete set null,
  product_title text not null,
  unit_price numeric(10, 2) not null,
  quantity integer not null default 1
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- La commande est créée depuis le site public (formulaire sur la fiche
-- produit), donc l'insertion doit être ouverte à "anon". La lecture reste
-- réservée à l'admin (données personnelles des clients).
create policy "orders_insert_public" on public.orders
  for insert to anon, authenticated with check (true);
create policy "orders_select_authenticated" on public.orders
  for select to authenticated using (true);
create policy "orders_update_authenticated" on public.orders
  for update to authenticated using (true);
create policy "orders_delete_authenticated" on public.orders
  for delete to authenticated using (true);

create policy "order_items_insert_public" on public.order_items
  for insert to anon, authenticated with check (true);
create policy "order_items_select_authenticated" on public.order_items
  for select to authenticated using (true);
create policy "order_items_delete_authenticated" on public.order_items
  for delete to authenticated using (true);

-- Quand une commande est passée sur une pièce disponible, elle passe
-- automatiquement en "réservé" (fonction privilégiée : la commande est
-- créée par un visiteur anonyme qui n'a pas le droit de modifier products).
create or replace function public.mark_product_reserved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
  set status = 'reserved'
  where id = new.product_id and status = 'available';
  return new;
end;
$$;

drop trigger if exists order_items_mark_reserved on public.order_items;
create trigger order_items_mark_reserved
  after insert on public.order_items
  for each row
  execute function public.mark_product_reserved();
