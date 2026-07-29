-- Retire le filtre "Toutes les séries" et le champ associé : plus utilisé
-- ni dans le dashboard ni sur Œuvres récentes.
alter table public.products
  drop column if exists series;
