"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";

export function ListBlockEditor({ initialItems }: { initialItems: string[] }) {
  const [items, setItems] = useState<string[]>(initialItems.length > 0 ? initialItems : [""]);

  function updateItem(index: number, value: string) {
    setItems((current) => current.map((item, i) => (i === index ? value : item)));
  }

  function addItem() {
    setItems((current) => [...current, ""]);
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
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-zinc-400">•</span>
          <input
            value={item}
            onChange={(event) => updateItem(index, event.target.value)}
            placeholder="Élément de la liste"
            className="flex-1 border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
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
      ))}
      <button
        type="button"
        onClick={addItem}
        className="self-start border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        + Ajouter un élément
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
