-- Ligne unique de paramètres pour la boutique
create table if not exists public.settings (
  id boolean primary key default true check (id = true),
  shop_name text not null default 'Blac_Kaleta',
  contact_email text not null default 'contact@blac-kaleta.com',
  payment_kkiapay boolean not null default false,
  payment_fedapay boolean not null default false,
  notify_email_per_order boolean not null default true,
  notify_realtime_popup boolean not null default true
);

insert into public.settings (id) values (true) on conflict (id) do nothing;

alter table public.settings enable row level security;

-- Le nom de la boutique et l'email de contact sont affichés sur le site
-- public (Accueil, Contact), donc la lecture doit être ouverte à "anon".
create policy "settings_select_public" on public.settings
  for select to anon, authenticated using (true);
create policy "settings_update_authenticated" on public.settings
  for update to authenticated using (true);
