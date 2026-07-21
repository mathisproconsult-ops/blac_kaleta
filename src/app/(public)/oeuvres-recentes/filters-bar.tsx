"use client";

import { useRouter, useSearchParams } from "next/navigation";

function useUpdateParam() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/oeuvres-recentes${params.toString() ? `?${params.toString()}` : ""}`);
  };
}

export function FiltersBar({
  years,
  seriesList,
  techniques,
  current,
}: {
  years: number[];
  seriesList: string[];
  techniques: string[];
  current: { annee?: string; serie?: string; technique?: string };
}) {
  const updateParam = useUpdateParam();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        defaultValue={current.annee ?? ""}
        onChange={(event) => updateParam("annee", event.target.value)}
        className="border border-zinc-300 px-2 py-1 text-sm"
      >
        <option value="">Toutes les années</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
      <select
        defaultValue={current.serie ?? ""}
        onChange={(event) => updateParam("serie", event.target.value)}
        className="border border-zinc-300 px-2 py-1 text-sm"
      >
        <option value="">Toutes les séries</option>
        {seriesList.map((series) => (
          <option key={series} value={series}>
            {series}
          </option>
        ))}
      </select>
      <select
        defaultValue={current.technique ?? ""}
        onChange={(event) => updateParam("technique", event.target.value)}
        className="border border-zinc-300 px-2 py-1 text-sm"
      >
        <option value="">Toutes les techniques</option>
        {techniques.map((technique) => (
          <option key={technique} value={technique}>
            {technique}
          </option>
        ))}
      </select>
    </div>
  );
}
