-- Ajoute Instagram et TikTok aux fournisseurs vidéo acceptés pour les liens
-- externes de "Œuvres récentes" (en plus de YouTube et Vimeo, migration 0031).

alter table public.recent_work_media
  drop constraint if exists recent_work_media_video_provider_check;

alter table public.recent_work_media
  add constraint recent_work_media_video_provider_check
    check (video_provider in ('youtube', 'vimeo', 'instagram', 'tiktok') or video_provider is null);
