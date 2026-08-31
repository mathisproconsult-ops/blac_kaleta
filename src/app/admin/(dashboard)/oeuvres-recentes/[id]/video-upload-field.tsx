"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MAX_UPLOAD_BYTES } from "@/lib/compress-image";

type UploadedVideo = {
  videoPath: string;
  videoUrl: string;
  thumbnailPath: string;
  thumbnailUrl: string;
  filename: string;
};

// Capture la première frame lisible de la vidéo dans un <canvas> pour en
// faire la vignette — entièrement côté navigateur, aucun traitement serveur
// (pas de dépendance vidéo type ffmpeg à ajouter au projet).
function extractVideoThumbnail(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    function cleanup() {
      URL.revokeObjectURL(objectUrl);
    }

    video.onloadeddata = () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        reject(new Error("Extraction de vignette impossible sur ce navigateur."));
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          cleanup();
          if (blob) resolve(blob);
          else reject(new Error("Extraction de vignette impossible."));
        },
        "image/webp",
        0.85,
      );
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Impossible de lire ce fichier vidéo."));
    };
  });
}

export function VideoUploadField() {
  const [uploaded, setUploaded] = useState<UploadedVideo | null>(null);
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

    try {
      const supabase = createClient();
      const videoPath = `library/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(videoPath, file, { contentType: file.type });
      if (uploadError) throw new Error(uploadError.message);
      const { data: videoUrlData } = supabase.storage.from("media").getPublicUrl(videoPath);

      const thumbnailBlob = await extractVideoThumbnail(file);
      const thumbnailPath = `library/${crypto.randomUUID()}-thumbnail.webp`;
      const { error: thumbnailError } = await supabase.storage
        .from("media")
        .upload(thumbnailPath, thumbnailBlob, { contentType: "image/webp" });
      if (thumbnailError) throw new Error(thumbnailError.message);
      const { data: thumbnailUrlData } = supabase.storage.from("media").getPublicUrl(thumbnailPath);

      setUploaded({
        videoPath,
        videoUrl: videoUrlData.publicUrl,
        thumbnailPath,
        thumbnailUrl: thumbnailUrlData.publicUrl,
        filename: file.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'envoi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="file"
        accept="video/*"
        disabled={pending}
        onChange={handleFile}
        className="text-sm"
      />
      {pending ? (
        <p className="text-xs text-zinc-500">Envoi et extraction de la vignette…</p>
      ) : null}
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      {uploaded ? (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={uploaded.thumbnailUrl} alt="" className="h-16 w-16 object-cover" />
          <p className="text-xs text-zinc-500">{uploaded.filename}</p>
        </div>
      ) : null}
      <input type="hidden" name="uploadedVideo" value={uploaded ? JSON.stringify(uploaded) : ""} />
    </div>
  );
}
