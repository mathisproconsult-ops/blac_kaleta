"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImageFile, MAX_UPLOAD_BYTES } from "@/lib/compress-image";

type UploadedImage = { path: string; url: string; filename: string; mimeType: string };

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function ImageUploadField() {
  const [uploaded, setUploaded] = useState<UploadedImage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    setPending(true);
    setError(null);
    const supabase = createClient();
    const results: UploadedImage[] = [];

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

  async function removeUploaded(path: string) {
    setUploaded((current) => current.filter((item) => item.path !== path));
    const supabase = createClient();
    await supabase.storage.from("media").remove([path]);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs uppercase tracking-wide text-zinc-500">
        Nouvelle photo (rejoint aussi la Médiathèque)
      </label>
      <input
        type="file"
        accept="image/*"
        multiple
        disabled={pending}
        onChange={handleFiles}
        className="text-sm"
      />
      <p className="text-xs text-zinc-400">
        {formatMegabytes(MAX_UPLOAD_BYTES)} maximum par photo — les photos
        volumineuses sont automatiquement réduites avant l&apos;envoi.
      </p>
      {pending ? <p className="text-xs text-zinc-500">Envoi en cours…</p> : null}
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      {uploaded.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {uploaded.map((item) => (
            <div key={item.path} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.filename}
                className="h-16 w-16 object-cover"
              />
              <button
                type="button"
                onClick={() => removeUploaded(item.path)}
                aria-label={`Retirer ${item.filename}`}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center bg-black text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <input type="hidden" name="uploadedImages" value={JSON.stringify(uploaded)} />
    </div>
  );
}
