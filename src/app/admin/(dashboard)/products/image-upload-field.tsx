"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type UploadedImage = { path: string; url: string; filename: string; mimeType: string };

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
      const path = `library/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        setError(`Échec de l'envoi de « ${file.name} » : ${uploadError.message}`);
        continue;
      }

      const { data } = supabase.storage.from("media").getPublicUrl(path);
      results.push({ path, url: data.publicUrl, filename: file.name, mimeType: file.type });
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
      {pending ? <p className="text-xs text-zinc-500">Envoi en cours…</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
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
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center bg-black text-xs text-white"
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
