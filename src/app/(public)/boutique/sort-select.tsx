"use client";

import { useRouter, useSearchParams } from "next/navigation";

const sortOptions = [
  { value: "default", label: "Par défaut" },
  { value: "prix-asc", label: "Prix croissant" },
  { value: "prix-desc", label: "Prix décroissant" },
];

export function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <select
      defaultValue={value}
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());
        if (event.target.value === "default") {
          params.delete("tri");
        } else {
          params.set("tri", event.target.value);
        }
        router.push(`/boutique?${params.toString()}`);
      }}
      className="border border-zinc-300 px-2 py-1 text-sm"
    >
      {sortOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
