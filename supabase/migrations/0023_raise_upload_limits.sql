-- Passe la limite de taille par fichier des buckets de 25 Mo (défaut projet)
-- à 100 Mo, pour suivre la limite applicative (MAX_UPLOAD_BYTES).
-- Note : le plafond réel appliqué reste borné par le plan Supabase du
-- projet (ex. certains plans gratuits plafonnent à 50 Mo par fichier
-- quelle que soit cette valeur) — à vérifier dans les paramètres du
-- projet si l'upload de très gros fichiers échoue malgré tout.
update storage.buckets
set file_size_limit = 100 * 1024 * 1024
where id in ('products', 'media', 'pages');
