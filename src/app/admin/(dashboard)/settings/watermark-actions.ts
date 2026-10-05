"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createSampleArtworkImage,
  previewWatermark,
  type WatermarkRenderSettings,
} from "@/lib/image-protection";
import type { WatermarkColor, WatermarkFontKey, WatermarkPosition } from "@/lib/settings";

const POSITIONS: WatermarkPosition[] = [
  "haut-gauche",
  "haut-droite",
  "bas-gauche",
  "bas-droite",
  "centre",
  "diagonale",
];
const FONTS: WatermarkFontKey[] = ["caveat", "playfair", "montserrat"];
const COLORS: WatermarkColor[] = ["blanc", "noir", "auto"];

// Lecture + validation communes aux deux actions (aperçu et enregistrement) :
// le formulaire envoie toujours les mêmes champs, qu'on reste sur un essai
// non enregistré ou qu'on confirme.
function parseDraftSettings(
  formData: FormData,
): { enabled: boolean; settings: WatermarkRenderSettings } | null {
  const text = formData.get("watermark_text");
  const position = formData.get("watermark_position");
  const font = formData.get("watermark_font");
  const sizePercentInput = formData.get("watermark_size_percent");
  const opacityInput = formData.get("watermark_opacity");
  const color = formData.get("watermark_color");

  if (typeof text !== "string") return null;
  if (typeof position !== "string" || !POSITIONS.includes(position as WatermarkPosition)) return null;
  if (typeof font !== "string" || !FONTS.includes(font as WatermarkFontKey)) return null;
  if (typeof color !== "string" || !COLORS.includes(color as WatermarkColor)) return null;

  const sizePercent = typeof sizePercentInput === "string" ? Number(sizePercentInput) : NaN;
  const opacity = typeof opacityInput === "string" ? Number(opacityInput) : NaN;
  if (!Number.isFinite(sizePercent) || sizePercent < 1 || sizePercent > 20) return null;
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 100) return null;

  return {
    enabled: formData.get("watermark_enabled") === "on",
    settings: {
      text: text.trim() || "Blac_Kaleta",
      position: position as WatermarkPosition,
      font: font as WatermarkFontKey,
      sizePercent,
      opacity,
      color: color as WatermarkColor,
    },
  };
}

export type WatermarkPreviewState = { previewDataUrl: string | null; error: string | null };

// Rendu réel (même pipeline sharp/pango que la régénération en masse), pas
// une approximation CSS côté client : seule façon de montrer fidèlement le
// futur rendu avant d'enregistrer, y compris le choix de police embarquée.
export async function previewWatermarkAction(
  _prevState: WatermarkPreviewState,
  formData: FormData,
): Promise<WatermarkPreviewState> {
  const parsed = parseDraftSettings(formData);
  if (!parsed) return { previewDataUrl: null, error: "Réglages invalides." };

  try {
    const sample = await createSampleArtworkImage();
    const result = await previewWatermark(sample, parsed.settings, parsed.enabled);
    const dataUrl = `data:${result.contentType};base64,${result.buffer.toString("base64")}`;
    return { previewDataUrl: dataUrl, error: null };
  } catch (err) {
    console.error("previewWatermarkAction", err);
    return { previewDataUrl: null, error: "Impossible de générer l'aperçu." };
  }
}

export type WatermarkSaveState = { success: boolean; error: string | null };

export async function updateWatermarkSettings(
  _prevState: WatermarkSaveState,
  formData: FormData,
): Promise<WatermarkSaveState> {
  const parsed = parseDraftSettings(formData);
  if (!parsed) return { success: false, error: "Réglages invalides." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      watermark_enabled: parsed.enabled,
      watermark_text: parsed.settings.text,
      watermark_position: parsed.settings.position,
      watermark_font: parsed.settings.font,
      watermark_size_percent: parsed.settings.sizePercent,
      watermark_opacity: parsed.settings.opacity,
      watermark_color: parsed.settings.color,
    })
    .eq("id", true);

  if (error) {
    console.error("updateWatermarkSettings", error);
    return { success: false, error: "Erreur base de données : " + error.message };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  updateTag("settings");

  return { success: true, error: null };
}
