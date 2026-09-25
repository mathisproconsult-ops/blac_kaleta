"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  LANGUAGES,
  SOURCE_LANGUAGE,
  isLanguageCode,
  type LanguageCode,
} from "@/lib/translation/languages";

const STORAGE_KEY = "blac-kaleta-lang";
// Un lot par requête : suffisant pour une page (quelques dizaines de
// textes uniques), évite une seule requête démesurée sur une page très
// riche en contenu (fiche produit avec beaucoup de variantes, etc.).
const BATCH_SIZE = 60;

type TranslationContextValue = {
  lang: LanguageCode;
  setLang: (code: LanguageCode) => void;
  languages: typeof LANGUAGES;
  translating: boolean;
};

const TranslationContext = createContext<TranslationContextValue | null>(null);

export function useTranslationContext() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error("useTranslationContext must be used within TranslationProvider");
  }
  return context;
}

function collectTextNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.textContent;
      if (!text || !text.trim()) return NodeFilter.FILTER_REJECT;
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      // data-no-translate : prix, montants, et tout autre texte qui ne
      // doit jamais passer par DeepL (voir ses usages sur les affichages
      // de prix). script/style/textarea : jamais du texte visible.
      if (parent.closest("[data-no-translate], script, style, noscript, textarea")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(SOURCE_LANGUAGE);
  const [translating, setTranslating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Texte d'origine (français) mémorisé par nœud, pour pouvoir revenir en
  // arrière sans nouvel appel réseau. WeakMap : les nœuds d'une page
  // quittée (navigation) deviennent naturellement inaccessibles, pas besoin
  // de les nettoyer à la main.
  const originalByNode = useRef(new WeakMap<Text, string>());
  const pathname = usePathname();
  // Incrémenté à chaque nouvelle traduction lancée : permet d'ignorer la
  // réponse d'un appel obsolète si l'utilisateur change de langue ou de
  // page avant qu'il ne revienne.
  const generation = useRef(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isLanguageCode(stored)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique de la préférence enregistrée, au montage
        setLangState(stored);
      }
    } catch {
      // Stockage indisponible (navigation privée...) : reste en français.
    }
  }, []);

  const applyTranslation = useCallback(async (targetLang: LanguageCode) => {
    const root = rootRef.current;
    if (!root) return;
    const myGeneration = ++generation.current;

    if (targetLang === SOURCE_LANGUAGE) {
      // Retour au français : restitution directe depuis le texte
      // d'origine mémorisé, sans appel réseau.
      for (const node of collectTextNodes(root)) {
        const original = originalByNode.current.get(node);
        if (original !== undefined) node.textContent = original;
      }
      setTranslating(false);
      return;
    }

    const nodes = collectTextNodes(root);
    const texts: string[] = [];
    const textNodes: Text[] = [];
    for (const node of nodes) {
      if (!originalByNode.current.has(node)) {
        originalByNode.current.set(node, node.textContent ?? "");
      }
      const original = originalByNode.current.get(node)!;
      if (original.trim()) {
        texts.push(original);
        textNodes.push(node);
      }
    }

    if (texts.length === 0) return;

    setTranslating(true);
    try {
      const translationByOriginal = new Map<string, string>();
      for (let start = 0; start < texts.length; start += BATCH_SIZE) {
        if (myGeneration !== generation.current) return;
        const batch = texts.slice(start, start + BATCH_SIZE);
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: batch, lang: targetLang }),
        });
        if (!response.ok) continue;
        const data = (await response.json()) as { translations: string[] };
        batch.forEach((text, index) => {
          translationByOriginal.set(text, data.translations[index] ?? text);
        });
      }

      if (myGeneration !== generation.current) return;

      textNodes.forEach((node, index) => {
        const translated = translationByOriginal.get(texts[index]);
        if (translated !== undefined) node.textContent = translated;
      });
    } catch (err) {
      console.error("applyTranslation", err);
    } finally {
      if (myGeneration === generation.current) setTranslating(false);
    }
  }, []);

  useEffect(() => {
    // setTranslating() est appelé plus loin dans applyTranslation() : sans
    // ce garde, le linter croit à un setState synchrone dans l'effet, alors
    // qu'il ne survient qu'après le fetch asynchrone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void applyTranslation(lang);
    // Se redéclenche à chaque changement de page (nouveau contenu à
    // traduire) et à chaque changement de langue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, pathname]);

  const setLang = useCallback((code: LanguageCode) => {
    setLangState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Stockage indisponible : le choix ne persiste pas au-delà de la page en cours.
    }
  }, []);

  return (
    <TranslationContext.Provider value={{ lang, setLang, languages: LANGUAGES, translating }}>
      {/* display:contents : ce conteneur n'a besoin d'exister que pour
          fournir une racine au parcours du DOM, il ne doit rien changer à
          la mise en page existante. */}
      <div ref={rootRef} className="contents">
        {children}
      </div>
    </TranslationContext.Provider>
  );
}
