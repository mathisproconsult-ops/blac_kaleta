"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const STOCK_OPTIONS = [
  { value: "tous", label: "Tous les stocks" },
  { value: "en-stock", label: "En stock" },
  { value: "faible", label: "Stock faible" },
  { value: "epuise", label: "Épuisé" },
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
  return `/admin/products?${params.toString()}`;
}

export function ProductFilters({
  search,
  category,
  stock,
  categories,
}: {
  search: string;
  category: string;
  stock: string;
  categories: { id: number; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(search);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        defaultValue={category}
        onChange={(event) =>
          router.push(withParam(searchParams, "categorie", event.target.value, "toutes"))
        }
        className="border border-zinc-300 px-2 py-2 text-sm"
      >
        <option value="toutes">Toutes les catégories</option>
        {categories.map((cat) => (
          <option key={cat.id} value={String(cat.id)}>
            {cat.name}
          </option>
        ))}
      </select>

      <select
        defaultValue={stock}
        onChange={(event) =>
          router.push(withParam(searchParams, "stock", event.target.value, "tous"))
        }
        className="border border-zinc-300 px-2 py-2 text-sm"
      >
        {STOCK_OPTIONS.map((option) => (
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
          placeholder="Rechercher des produits"
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
        <button
          type="submit"
          className="border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          Rechercher
        </button>
      </form>
    </div>
  );
}
