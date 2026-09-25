import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasRemainingQuota, translateTexts } from "@/lib/translation/deepl";
import { deeplTargetFor, isLanguageCode, SOURCE_LANGUAGE } from "@/lib/translation/languages";

export const dynamic = "force-dynamic";

// Garde-fous anti-abus : cette route est publique et appelle une API
// payante au quota mensuel limité — un appel unique ne doit jamais pouvoir
// épuiser le quota à lui seul, et un visiteur ne doit pas pouvoir en abuser
// pour en priver les autres.
const MAX_TEXTS_PER_REQUEST = 100;
const MAX_TEXT_LENGTH = 2000;
const MAX_TOTAL_CHARS_PER_REQUEST = 20000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

// Compteur en mémoire, best-effort (par instance serveur, pas partagé entre
// régions/instances) : suffisant pour amortir un visiteur abusif isolé,
// pas conçu comme une protection anti-DDoS distribuée.
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(key) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  timestamps.push(now);
  requestLog.set(key, timestamps);
  return timestamps.length > RATE_LIMIT_MAX_REQUESTS;
}

function clientKey(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function POST(request: NextRequest) {
  if (isRateLimited(clientKey(request))) {
    return NextResponse.json({ error: "Trop de requêtes, réessaie dans un instant." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const { texts, lang } = (body ?? {}) as { texts?: unknown; lang?: unknown };

  if (!Array.isArray(texts) || texts.length === 0 || texts.length > MAX_TEXTS_PER_REQUEST) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (typeof lang !== "string" || !isLanguageCode(lang) || lang === SOURCE_LANGUAGE) {
    return NextResponse.json({ error: "Langue non supportée." }, { status: 400 });
  }
  const targetLang = deeplTargetFor(lang);
  if (!targetLang) {
    return NextResponse.json({ error: "Langue non supportée." }, { status: 400 });
  }

  const cleanTexts: string[] = [];
  let totalChars = 0;
  for (const entry of texts) {
    if (typeof entry !== "string") {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }
    const trimmed = entry.slice(0, MAX_TEXT_LENGTH);
    totalChars += trimmed.length;
    cleanTexts.push(trimmed);
  }
  if (totalChars > MAX_TOTAL_CHARS_PER_REQUEST) {
    return NextResponse.json({ error: "Trop de texte à traduire en une seule fois." }, { status: 400 });
  }

  // Dédoublonnage : un même texte (ex. "Ajouter au panier") apparaît
  // souvent plusieurs fois sur une page — un seul appel de cache/DeepL par
  // texte unique, jamais un par occurrence.
  const uniqueTexts = Array.from(new Set(cleanTexts));
  const hashes = uniqueTexts.map(hashText);

  const supabase = createAdminClient();
  const { data: cached } = await supabase
    .from("translation_cache")
    .select("text_hash, translated_text")
    .eq("target_lang", targetLang)
    .in("text_hash", hashes);

  const translatedByHash = new Map<string, string>(
    (cached ?? []).map((row) => [row.text_hash as string, row.translated_text as string]),
  );

  const missing = uniqueTexts
    .map((text, index) => ({ text, hash: hashes[index] }))
    .filter(({ hash }) => !translatedByHash.has(hash));

  if (missing.length > 0) {
    const additionalChars = missing.reduce((sum, entry) => sum + entry.text.length, 0);
    const withinBudget = await hasRemainingQuota(additionalChars);

    if (withinBudget) {
      try {
        const translations = await translateTexts(
          missing.map((entry) => entry.text),
          targetLang,
        );
        const rows = missing.map((entry, index) => ({
          text_hash: entry.hash,
          target_lang: targetLang,
          source_text: entry.text,
          translated_text: translations[index] ?? entry.text,
        }));
        await supabase
          .from("translation_cache")
          .upsert(rows, { onConflict: "text_hash,target_lang" });
        for (const row of rows) translatedByHash.set(row.text_hash, row.translated_text);
      } catch (err) {
        console.error("POST /api/translate", err);
        // Best-effort : les textes non traduits retombent sur le texte
        // source plus bas, la page reste utilisable.
      }
    }
  }

  const translations = cleanTexts.map((text) => {
    const hash = hashText(text);
    return translatedByHash.get(hash) ?? text;
  });

  return NextResponse.json({ translations }, { headers: { "Cache-Control": "no-store" } });
}
