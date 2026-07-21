alter table public.settings
  add column if not exists social_instagram text,
  add column if not exists social_facebook text,
  add column if not exists social_whatsapp text,
  add column if not exists social_youtube text,
  add column if not exists social_tiktok text,
  add column if not exists social_patreon text;
