"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

const KIND_OPTIONS = [
  { value: "tous", label: "Tous les types" },
  { value: "image", label: "Images" },
  { value: "gif", label: "Gifs" },
  { value: "pdf", label: "PDF" },
  { value: "other", label: "Autres" },
];

function withParam(
  searchParams: URLSearchParams,
  key: string,
  value: string,
  fallback: string,
) {
  const params = new URLSearchParams(searchParams.toString());
  if (value === fallback) {
    params.delete(key);
  } else {
    params.set(key, value);
  }
  return `/admin/media?${params.toString()}`;
}

export function MediaFilters({
  search,
  kind,
  date,
  dateOptions,
}: {
  search: string;
  kind: string;
  date: string;
  dateOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(search);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        defaultValue={kind}
        onChange={(event) =>
          router.push(withParam(searchParams, "type", event.target.value, "tous"))
        }
        className="border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700"
      >
        {KIND_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        defaultValue={date}
        onChange={(event) =>
          router.push(withParam(searchParams, "date", event.target.value, "toutes"))
        }
        className="border border-zinc-300 px-2 py-2 text-sm dark:border-zinc-700"
      >
        <option value="toutes">Toutes les dates</option>
        {dateOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          router.push(withParam(searchParams, "recherche", searchValue.trim(), ""));
        }}
        className="flex items-center gap-2"
      >
        <input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Rechercher des médias"
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
        />
        <button
          type="submit"
          className="border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Rechercher
        </button>
      </form>
    </div>
  );
}

export function MediaViewToggle({ view }: { view: "grille" | "liste" }) {
  const searchParams = useSearchParams();

  return (
    <div className="flex items-center border border-zinc-300 text-sm dark:border-zinc-700">
      <Link
        href={withParam(searchParams, "vue", "grille", "grille")}
        aria-label="Vue grille"
        className={
          view === "grille"
            ? "bg-black px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "px-3 py-2 text-zinc-500 hover:text-black dark:hover:text-zinc-100"
        }
      >
        Grille
      </Link>
      <Link
        href={withParam(searchParams, "vue", "liste", "grille")}
        aria-label="Vue liste"
        className={
          view === "liste"
            ? "bg-black px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "px-3 py-2 text-zinc-500 hover:text-black dark:hover:text-zinc-100"
        }
      >
        Liste
      </Link>
    </div>
  );
}
