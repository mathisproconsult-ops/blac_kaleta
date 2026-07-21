create table if not exists public.contact_messages (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

-- Le formulaire de contact est public (visiteur non connecté), donc
-- l'insertion doit être ouverte à "anon". La lecture reste réservée à l'admin.
create policy "contact_messages_insert_public" on public.contact_messages
  for insert to anon, authenticated with check (true);
create policy "contact_messages_select_authenticated" on public.contact_messages
  for select to authenticated using (true);
create policy "contact_messages_delete_authenticated" on public.contact_messages
  for delete to authenticated using (true);
