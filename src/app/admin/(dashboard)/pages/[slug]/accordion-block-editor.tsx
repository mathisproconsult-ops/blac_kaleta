"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import type { AccordionItem } from "@/lib/page-blocks";

function emptyItem(): AccordionItem {
  return { question: "", answer: "" };
}

export function AccordionBlockEditor({ initialItems }: { initialItems: AccordionItem[] }) {
  const [items, setItems] = useState<AccordionItem[]>(
    initialItems.length > 0 ? initialItems : [emptyItem()],
  );

  function updateItem(index: number, field: "question" | "answer", value: string) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    setItems((current) => [...current, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  function moveItem(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    setItems((current) => {
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div key={index} className="border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Question {index + 1}</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => moveItem(index, "up")}
                disabled={index === 0}
                aria-label="Monter"
                className="text-xs text-zinc-500 hover:text-black disabled:opacity-20 dark:hover:text-zinc-100"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveItem(index, "down")}
                disabled={index === items.length - 1}
                aria-label="Descendre"
                className="text-xs text-zinc-500 hover:text-black disabled:opacity-20 dark:hover:text-zinc-100"
              >
                ▼
              </button>
              <button
                type="button"
                onClick={() => removeItem(index)}
                disabled={items.length === 1}
                className="text-xs text-red-600 hover:underline disabled:opacity-20 dark:text-red-400"
              >
                Supprimer
              </button>
            </div>
          </div>
          <input
            value={item.question}
            onChange={(event) => updateItem(index, "question", event.target.value)}
            placeholder="Question"
            className="mt-2 w-full border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
          <textarea
            value={item.answer}
            onChange={(event) => updateItem(index, "answer", event.target.value)}
            placeholder="Réponse"
            rows={3}
            className="mt-2 w-full border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="self-start border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        + Ajouter une question
      </button>
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <SubmitButton
        pendingText="Enregistrement…"
        className="self-start bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        Enregistrer
      </SubmitButton>
    </div>
  );
}
