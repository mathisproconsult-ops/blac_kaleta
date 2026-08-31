"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { SinglePhotoUploadField } from "./single-photo-upload-field";
import { VideoUploadField } from "./video-upload-field";
import {
  createRecentWorkPhoto,
  createRecentWorkVideoLink,
  createRecentWorkVideoUpload,
  type RecentWorkFormState,
} from "./actions";

const initialState: RecentWorkFormState = { success: false, error: null };

type Mode = "photo" | "video-upload" | "video-link";

export function AddRecentWorkForm({
  categoryId,
  techniques,
}: {
  categoryId: number;
  techniques: { id: number; name: string }[];
}) {
  const [mode, setMode] = useState<Mode>("photo");
  const action =
    mode === "photo"
      ? createRecentWorkPhoto.bind(null, categoryId)
      : mode === "video-upload"
        ? createRecentWorkVideoUpload.bind(null, categoryId)
        : createRecentWorkVideoLink.bind(null, categoryId);

  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={mode === "photo"}
            onChange={() => setMode("photo")}
          />
          Photo
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={mode === "video-upload"}
            onChange={() => setMode("video-upload")}
          />
          Vidéo — upload
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={mode === "video-link"}
            onChange={() => setMode("video-link")}
          />
          Vidéo — lien YouTube/Vimeo
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">Titre</label>
          <input
            name="title"
            required
            className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">Année</label>
          <input
            name="year"
            type="number"
            className="w-24 border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">Technique</label>
          <select
            name="technique_id"
            defaultValue=""
            className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          >
            <option value="">—</option>
            {techniques.map((technique) => (
              <option key={technique.id} value={technique.id}>
                {technique.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mode === "photo" ? (
        <SinglePhotoUploadField />
      ) : mode === "video-upload" ? (
        <VideoUploadField />
      ) : (
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Lien YouTube ou Vimeo
          </label>
          <input
            name="externalUrl"
            type="url"
            autoComplete="off"
            placeholder="https://youtube.com/watch?v=... ou https://vimeo.com/..."
            className="max-w-md border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
          <p className="text-xs text-zinc-400">
            La vignette est récupérée automatiquement depuis la plateforme.
          </p>
        </div>
      )}

      <SubmitButton
        pendingText="Ajout…"
        className="self-start bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        Ajouter
      </SubmitButton>

      {state.error ? (
        <p className="border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          ⚠ {state.error}
        </p>
      ) : state.success ? (
        <p className="border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          ✓ Ajouté.
        </p>
      ) : null}
    </form>
  );
}
