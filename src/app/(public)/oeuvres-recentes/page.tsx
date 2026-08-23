import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FiltersBar } from "./filters-bar";
import { LightboxGallery } from "./lightbox-gallery";

export const metadata: Metadata = {
  title: "Œuvres récentes — Blac_Kaleta",
};

type Work = {
  id: number;
  title: string;
  year: number | null;
  techniques: { name: string } | null;
  product_images: { url: string; position: number }[];
};

export default async function RecentWorksPage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; technique?: string }>;
}) {
  const { annee, technique } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select("id, title, year, techniques(name), product_images(url, position)")
    .eq("show_in_recent_works", true)
    .eq("is_visible", true)
    .is("deleted_at", null)
    .order("year", { ascending: false })
    .returns<Work[]>();

  const works = data ?? [];

  const years = Array.from(
    new Set(works.map((work) => work.year).filter((year): year is number => year !== null)),
  ).sort((a, b) => b - a);
  const techniques = Array.from(
    new Set(
      works.map((work) => work.techniques?.name).filter((name): name is string => Boolean(name)),
    ),
  ).sort();

  let filtered = works;
  if (annee) filtered = filtered.filter((work) => String(work.year) === annee);
  if (technique) filtered = filtered.filter((work) => work.techniques?.name === technique);

  const hasFilters = Boolean(annee || technique);

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Œuvres récentes
      </h1>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <FiltersBar
          years={years}
          techniques={techniques}
          current={{ annee, technique }}
        />
        <div className="flex items-center gap-4">
          {hasFilters ? (
            <Link href="/oeuvres-recentes" className="text-sm text-zinc-500 underline">
              Reset
            </Link>
          ) : null}
          <p className="text-sm text-zinc-500">
            {filtered.length} œuvre{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-12 text-sm text-zinc-500">Aucune œuvre ne correspond à ces filtres.</p>
      ) : (
        <LightboxGallery
          works={filtered.map((work) => ({
            id: work.id,
            title: work.title,
            year: work.year,
            technique: work.techniques?.name ?? null,
            imageUrl:
              [...work.product_images].sort((a, b) => a.position - b.position)[0]?.url ?? null,
          }))}
        />
      )}
    </div>
  );
}
