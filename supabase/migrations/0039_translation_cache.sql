-- Cache des traductions DeepL, partagé entre tous les visiteurs et
-- persistant entre déploiements : un même texte (ex. "Ajouter au panier",
-- le titre d'une œuvre) n'est jamais renvoyé à DeepL une deuxième fois pour
-- une même langue cible, ce qui est le principal levier de maîtrise du
-- quota gratuit (500 000 caractères/mois). Clé par empreinte du texte
-- source plutôt que par le texte lui-même : plus compact, et insensible à
-- la taille du contenu source.

create table if not exists public.translation_cache (
  id bigint generated always as identity primary key,
  text_hash text not null,
  target_lang text not null,
  source_text text not null,
  translated_text text not null,
  created_at timestamptz not null default now(),
  unique (text_hash, target_lang)
);

create index if not exists translation_cache_lookup_idx
  on public.translation_cache (target_lang, text_hash);

-- RLS activée sans policy publique : cette table n'est jamais lue ni
-- écrite directement par le navigateur, uniquement par la route serveur
-- /api/translate via le client service_role (voir lib/supabase/admin.ts).
alter table public.translation_cache enable row level security;
