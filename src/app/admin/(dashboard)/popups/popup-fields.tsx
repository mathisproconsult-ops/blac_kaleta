"use client";

import { useState } from "react";

type DefaultValues = {
  title: string;
  body: string;
  button_text: string | null;
  button_url: string | null;
  scope: "all" | "home" | "page";
  scope_page_path: string | null;
  frequency: "once" | "every_session";
  is_active: boolean;
  image_url: string | null;
};

type MediaItem = { id: number; filename: string; url: string };

export function PopupFormFields({
  defaultValues,
  mediaList = [],
}: {
  defaultValues?: DefaultValues;
  mediaList?: MediaItem[];
}) {
  const [scope, setScope] = useState<"all" | "home" | "page">(defaultValues?.scope ?? "all");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-xs uppercase tracking-wide text-zinc-500">Titre</label>
        <input
          name="title"
          required
          defaultValue={defaultValues?.title}
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-xs uppercase tracking-wide text-zinc-500">Texte</label>
        <textarea
          name="body"
          required
          rows={3}
          defaultValue={defaultValues?.body}
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          Texte du bouton (optionnel)
        </label>
        <input
          name="button_text"
          defaultValue={defaultValues?.button_text ?? ""}
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          Lien du bouton (optionnel)
        </label>
        <input
          name="button_url"
          defaultValue={defaultValues?.button_url ?? ""}
          placeholder="/boutique"
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">Où s&apos;affiche-t-elle</label>
        <select
          name="scope"
          value={scope}
          onChange={(event) => setScope(event.target.value as "all" | "home" | "page")}
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
        >
          <option value="all">Toutes les pages</option>
          <option value="home">Page d&apos;accueil uniquement</option>
          <option value="page">Une page précise</option>
        </select>
      </div>
      {scope === "page" ? (
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">Chemin de la page</label>
          <input
            name="scope_page_path"
            defaultValue={defaultValues?.scope_page_path ?? ""}
            placeholder="/boutique"
            className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">Quand</label>
        <select
          name="frequency"
          defaultValue={defaultValues?.frequency ?? "once"}
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
        >
          <option value="once">Une seule fois par visiteur</option>
          <option value="every_session">À chaque nouvelle session de navigation</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="is_active" defaultChecked={defaultValues?.is_active ?? true} />
        Active
      </label>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          Image (optionnelle)
        </label>
        {defaultValues?.image_url ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={defaultValues.image_url} alt="" className="h-16 w-16 object-cover" />
            <label className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <input type="checkbox" name="remove_image" />
              Retirer l&apos;image actuelle
            </label>
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Nouvelle image
          </label>
          <input type="file" name="image_file" accept="image/*" className="text-sm" />
        </div>
        {mediaList.length > 0 ? (
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs uppercase tracking-wide text-zinc-500">
              Ou choisir depuis la Médiathèque
            </legend>
            <div className="flex max-h-48 flex-wrap gap-3 overflow-y-auto">
              {mediaList.map((media) => (
                <label key={media.id} className="flex flex-col items-center gap-1 text-xs">
                  <input type="radio" name="mediaId" value={media.id} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={media.url}
                    alt={media.filename}
                    className="h-16 w-16 object-cover"
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
      </div>
    </div>
  );
}
