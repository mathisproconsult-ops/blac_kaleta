"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImageFile, MAX_UPLOAD_BYTES } from "@/lib/compress-image";

type UploadedFile = { path: string; url: string; filename: string; mimeType: string };

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function MediaUploadField() {
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    setPending(true);
    setError(null);
    const supabase = createClient();
    const results: UploadedFile[] = [];

    for (const file of files) {
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(
          `« ${file.name} » (${formatMegabytes(file.size)}) dépasse la taille maximale de ${formatMegabytes(MAX_UPLOAD_BYTES)}.`,
        );
        continue;
      }

      const toUpload = await compressImageFile(file);
      const path = `library/${crypto.randomUUID()}-${toUpload.name}`;
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(path, toUpload, { contentType: toUpload.type });

      if (uploadError) {
        setError(`Échec de l'envoi de « ${file.name} » : ${uploadError.message}`);
        continue;
      }

      const { data } = supabase.storage.from("media").getPublicUrl(path);
      results.push({
        path,
        url: data.publicUrl,
        filename: toUpload.name,
        mimeType: toUpload.type,
      });
    }

    setUploaded((current) => [...current, ...results]);
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="file"
        accept="image/*,application/pdf"
        multiple
        disabled={pending}
        onChange={handleFiles}
        className="text-sm"
      />
      <p className="text-xs text-zinc-400">
        {formatMegabytes(MAX_UPLOAD_BYTES)} maximum par fichier — les photos
        volumineuses sont automatiquement réduites avant l&apos;envoi.
      </p>
      {pending ? <p className="text-xs text-zinc-500">Envoi en cours…</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {uploaded.length > 0 ? (
        <p className="text-xs text-zinc-500">
          {uploaded.length} fichier(s) prêt(s) — clique sur « Ajouter à la
          Médiathèque » pour terminer.
        </p>
      ) : null}
      <input type="hidden" name="uploadedFiles" value={JSON.stringify(uploaded)} />
    </div>
  );
}
