-- La table pages n'avait qu'une policy de lecture ; il manquait les
-- policies d'écriture pour permettre de créer/modifier/supprimer des
-- pages depuis l'admin.
create policy "pages_insert_authenticated" on public.pages
  for insert to authenticated with check (true);
create policy "pages_update_authenticated" on public.pages
  for update to authenticated using (true);
create policy "pages_delete_authenticated" on public.pages
  for delete to authenticated using (true);
