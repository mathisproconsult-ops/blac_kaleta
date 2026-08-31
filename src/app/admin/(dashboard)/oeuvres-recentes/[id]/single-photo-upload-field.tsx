"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImageFile, MAX_UPLOAD_BYTES } from "@/lib/compress-image";

type UploadedImage = { path: string; url: string; filename: string; mimeType: string };

export function SinglePhotoUploadField() {
  const [uploaded, setUploaded] = useState<UploadedImage | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`Fichier trop volumineux (${(file.size / (1024 * 1024)).toFixed(1)} Mo).`);
      return;
    }

    setPending(true);
    setError(null);

    const toUpload = await compressImageFile(file);
    const path = `library/${crypto.randomUUID()}-${toUpload.name}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(path, toUpload, { contentType: toUpload.type });

    if (uploadError) {
      setError("Échec de l'envoi : " + uploadError.message);
      setPending(false);
      return;
    }

    const { data } = supabase.storage.from("media").getPublicUrl(path);
    setUploaded({ path, url: data.publicUrl, filename: toUpload.name, mimeType: toUpload.type });
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="file"
        accept="image/*"
        disabled={pending}
        onChange={handleFile}
        className="text-sm"
      />
      {pending ? <p className="text-xs text-zinc-500">Envoi en cours…</p> : null}
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      {uploaded ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={uploaded.url} alt={uploaded.filename} className="h-16 w-16 object-cover" />
      ) : null}
      <input type="hidden" name="uploadedImage" value={uploaded ? JSON.stringify(uploaded) : ""} />
    </div>
  );
}
