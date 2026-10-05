"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import type { WatermarkColor, WatermarkFontKey, WatermarkPosition } from "@/lib/settings";
import {
  previewWatermarkAction,
  updateWatermarkSettings,
  type WatermarkPreviewState,
  type WatermarkSaveState,
} from "./watermark-actions";

const POSITION_OPTIONS: { value: WatermarkPosition; label: string }[] = [
  { value: "haut-gauche", label: "Haut gauche" },
  { value: "haut-droite", label: "Haut droite" },
  { value: "bas-gauche", label: "Bas gauche" },
  { value: "bas-droite", label: "Bas droite" },
  { value: "centre", label: "Centre" },
  { value: "diagonale", label: "Diagonale répétée" },
];

const FONT_OPTIONS: { value: WatermarkFontKey; label: string }[] = [
  { value: "caveat", label: "Caveat (manuscrite)" },
  { value: "playfair", label: "Playfair Display (élégante)" },
  { value: "montserrat", label: "Montserrat (moderne)" },
];

const COLOR_OPTIONS: { value: WatermarkColor; label: string }[] = [
  { value: "auto", label: "Auto (adaptée au fond de chaque image)" },
  { value: "blanc", label: "Blanc" },
  { value: "noir", label: "Noir" },
];

const initialPreviewState: WatermarkPreviewState = { previewDataUrl: null, error: null };
const initialSaveState: WatermarkSaveState = { success: false, error: null };

export function WatermarkSection({
  enabled,
  text,
  position,
  font,
  sizePercent,
  opacity,
  color,
}: {
  enabled: boolean;
  text: string;
  position: WatermarkPosition;
  font: WatermarkFontKey;
  sizePercent: number;
  opacity: number;
  color: WatermarkColor;
}) {
  const [previewState, previewAction] = useActionState(previewWatermarkAction, initialPreviewState);
  const [saveState, saveAction] = useActionState(updateWatermarkSettings, initialSaveState);
  const [isEnabled, setIsEnabled] = useState(enabled);

  const formRef = useRef<HTMLFormElement>(null);
  const previewButtonRef = useRef<HTMLButtonElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function triggerPreview() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (formRef.current && previewButtonRef.current) {
        formRef.current.requestSubmit(previewButtonRef.current);
      }
    }, 300);
  }

  // Aperçu généré une première fois dès l'arrivée sur la page, avec les
  // réglages actuellement enregistrés — pas besoin d'y toucher pour voir le
  // rendu courant.
  useEffect(() => {
    if (formRef.current && previewButtonRef.current) {
      formRef.current.requestSubmit(previewButtonRef.current);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <fieldset className="mt-8 flex max-w-2xl flex-col gap-3">
      <legend className="text-sm font-semibold uppercase tracking-wide">Filigrane</legend>
      <p className="text-xs text-zinc-500">
        Protège les œuvres affichées publiquement contre la copie. L&apos;aperçu
        ci-dessous reflète le rendu réel, généré par le même outil que la
        régénération en masse.
      </p>

      {!isEnabled ? (
        <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          ⚠ Filigrane désactivé : les œuvres publiées ne sont plus protégées
          contre la copie.
        </p>
      ) : null}

      <form ref={formRef} action={saveAction} className="flex flex-col gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="watermark_enabled"
            defaultChecked={enabled}
            onChange={(e) => {
              setIsEnabled(e.target.checked);
              triggerPreview();
            }}
          />
          Activer le filigrane
        </label>

        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">Texte</label>
          <input
            name="watermark_text"
            defaultValue={text}
            maxLength={60}
            onInput={triggerPreview}
            className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-zinc-500">Position</label>
            <select
              name="watermark_position"
              defaultValue={position}
              onChange={triggerPreview}
              className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
            >
              {POSITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-zinc-500">Police</label>
            <select
              name="watermark_font"
              defaultValue={font}
              onChange={triggerPreview}
              className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
            >
              {FONT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-zinc-500">
              Taille (% de la largeur de l&apos;image)
            </label>
            <input
              type="range"
              name="watermark_size_percent"
              min={1}
              max={20}
              step={0.5}
              defaultValue={sizePercent}
              onChange={triggerPreview}
              className="w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-zinc-500">Opacité</label>
            <input
              type="range"
              name="watermark_opacity"
              min={0}
              max={100}
              step={1}
              defaultValue={opacity}
              onChange={triggerPreview}
              className="w-full"
            />
          </div>

          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide text-zinc-500">Couleur</label>
            <select
              name="watermark_color"
              defaultValue={color}
              onChange={triggerPreview}
              className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
            >
              {COLOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-wide text-zinc-500">Aperçu</label>
          <div className="flex min-h-[200px] items-center justify-center border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
            {previewState.previewDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewState.previewDataUrl}
                alt="Aperçu du filigrane sur une image d'exemple"
                className="max-h-[300px] w-auto max-w-full"
              />
            ) : (
              <p className="text-xs text-zinc-400">Aperçu en cours…</p>
            )}
          </div>
          {previewState.error ? (
            <p className="text-xs text-red-600 dark:text-red-400">{previewState.error}</p>
          ) : null}
          {/* Bouton réel (pas SubmitButton, qui ne transmet pas de ref) :
              déclenché automatiquement par les champs ci-dessus via
              requestSubmit, et reste utilisable manuellement (ex. au clavier
              depuis un champ texte, qui soumet aussi via Entrée). */}
          <button
            ref={previewButtonRef}
            type="submit"
            formAction={previewAction}
            className="self-start border border-zinc-300 px-4 py-2 text-xs font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Rafraîchir l&apos;aperçu
          </button>
        </div>

        <p className="text-xs text-zinc-500">
          Un changement de réglage ne s&apos;applique aux images déjà publiées
          qu&apos;après avoir relancé « Régénérer le filigrane sur toutes les
          images » (page Médiathèque) — il repart toujours des fichiers
          originaux, jamais d&apos;une copie déjà compressée.
        </p>

        <SubmitButton
          pendingText="Enregistrement…"
          className="self-start bg-black px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Enregistrer le filigrane
        </SubmitButton>
        <div aria-live="polite">
          {saveState.error ? (
            <p className="border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              ⚠ {saveState.error}
            </p>
          ) : saveState.success ? (
            <p className="border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
              ✓ Filigrane enregistré.
            </p>
          ) : null}
        </div>
      </form>
    </fieldset>
  );
}
