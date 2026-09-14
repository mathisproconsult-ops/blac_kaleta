-- Catégorie "+18" pour Œuvres récentes : les entrées de ces catégories sont
-- floutées côté serveur tant que le visiteur n'a pas confirmé être majeur
-- (voir age-gate.tsx et la page de catégorie publique).

alter table public.recent_work_categories
  add column if not exists age_restricted boolean not null default false;

-- Vignette floutée servie par défaut (avant vérification d'âge), distincte
-- de image_path/image_url qui reste la vignette nette (vue admin, et vue
-- publique une fois l'âge vérifié).
alter table public.recent_work_media
  add column if not exists image_blurred_path text,
  add column if not exists image_blurred_url text;

insert into public.recent_work_categories (name, position, age_restricted)
select '+18', coalesce((select max(position) + 1 from public.recent_work_categories), 0), true
where not exists (select 1 from public.recent_work_categories where name = '+18');
