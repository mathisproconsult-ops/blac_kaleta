import { unstable_cache } from "next/cache";

// Clé se terminant par ":fx" (palier Developer/gratuit) : ces comptes ne
// sont accessibles que via l'hôte api-free, jamais api.deepl.com.
const DEEPL_API_BASE = "https://api-free.deepl.com/v2";

// Marge de sécurité sous la vraie limite mensuelle (500 000 caractères sur
// le palier gratuit) : on préfère arrêter un peu tôt plutôt que de tomber
// en pleine panne DeepL au milieu du mois.
const USAGE_SAFETY_RATIO = 0.95;

function apiKey(): string {
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw new Error("DEEPL_API_KEY manquante.");
  return key;
}

export async function translateTexts(texts: string[], targetLang: string): Promise<string[]> {
  const response = await fetch(`${DEEPL_API_BASE}/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: texts,
      target_lang: targetLang,
      preserve_formatting: true,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`DeepL a répondu ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { translations: { text: string }[] };
  return data.translations.map((entry) => entry.text);
}

type UsageInfo = { characterCount: number; characterLimit: number };

// Mémorisé 10 minutes : l'endpoint /usage ne consomme pas de quota de
// traduction, mais autant éviter de l'appeler à chaque requête de chaque
// visiteur.
const getUsage = unstable_cache(
  async (): Promise<UsageInfo | null> => {
    try {
      const response = await fetch(`${DEEPL_API_BASE}/usage`, {
        headers: { Authorization: `DeepL-Auth-Key ${apiKey()}` },
        cache: "no-store",
      });
      if (!response.ok) return null;
      const data = (await response.json()) as {
        character_count: number;
        character_limit: number;
      };
      return { characterCount: data.character_count, characterLimit: data.character_limit };
    } catch (err) {
      console.error("deepl usage", err);
      return null;
    }
  },
  ["deepl-usage"],
  { revalidate: 600 },
);

// Best-effort : si le contrôle de quota échoue (réseau, DeepL indisponible),
// on ne bloque pas la traduction plutôt que de casser toute la fonctionnalité
// pour un simple souci de monitoring.
export async function hasRemainingQuota(additionalChars: number): Promise<boolean> {
  const usage = await getUsage();
  if (!usage) return true;
  return usage.characterCount + additionalChars <= usage.characterLimit * USAGE_SAFETY_RATIO;
}
