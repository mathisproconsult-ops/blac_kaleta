"use client";

import { useState } from "react";
import { FaGlobe } from "react-icons/fa6";
import { useTranslationContext } from "@/components/translation-provider";

export function LanguageSelector({ className }: { className?: string }) {
  const { lang, setLang, languages, translating } = useTranslationContext();
  const [open, setOpen] = useState(false);

  const current = languages.find((language) => language.code === lang) ?? languages[0];

  return (
    <div className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Choisir la langue"
        aria-expanded={open}
        title={current.label}
        className="flex h-9 items-center gap-1.5 rounded-full px-2 text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <FaGlobe className={translating ? "animate-pulse" : ""} aria-hidden />
        <span className="text-xs font-medium uppercase" data-no-translate>
          {current.code}
        </span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 w-36 border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            {languages.map((language) => (
              <button
                key={language.code}
                type="button"
                onClick={() => {
                  setLang(language.code);
                  setOpen(false);
                }}
                className={
                  language.code === lang
                    ? "block w-full px-3 py-2 text-left text-sm font-semibold dark:text-zinc-100"
                    : "block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                }
              >
                {language.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
