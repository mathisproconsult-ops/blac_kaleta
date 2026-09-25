export type LanguageCode = "fr" | "en" | "es";

export type Language = {
  code: LanguageCode;
  label: string;
  // Code cible attendu par l'API DeepL. Absent pour le français : c'est la
  // langue source du site, jamais besoin de la lui traduire.
  deeplTarget: string | null;
};

// Liste extensible : ajouter une langue = ajouter une entrée ici (le
// sélecteur dans l'en-tête et la route /api/translate s'adaptent
// automatiquement, aucun autre fichier à toucher).
export const LANGUAGES: Language[] = [
  { code: "fr", label: "Français", deeplTarget: null },
  { code: "en", label: "English", deeplTarget: "EN-US" },
  { code: "es", label: "Español", deeplTarget: "ES" },
];

export const SOURCE_LANGUAGE: LanguageCode = "fr";

export function isLanguageCode(value: string): value is LanguageCode {
  return LANGUAGES.some((language) => language.code === value);
}

export function deeplTargetFor(code: LanguageCode): string | null {
  return LANGUAGES.find((language) => language.code === code)?.deeplTarget ?? null;
}
