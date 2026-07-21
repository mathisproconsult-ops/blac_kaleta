import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FiltersBar } from "./filters-bar";

export const metadata: Metadata = {
  title: "Œuvres récentes — Blac_Kaleta",
};

type Work = {
  id: number;
  title: string;
  year: number | null;
  series: string | null;
  technique: string | null;
  product_images: { url: string; position: number }[];
};

export default async function RecentWorksPage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; serie?: string; technique?: string }>;
}) {
  const { annee, serie, technique } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select("id, title, year, series, technique, product_images(url, position)")
    .eq("show_in_recent_works", true)
    .eq("is_visible", true)
    .order("year", { ascending: false })
    .returns<Work[]>();

  const works = data ?? [];

  const years = Array.from(
    new Set(works.map((work) => work.year).filter((year): year is number => year !== null)),
  ).sort((a, b) => b - a);
  const seriesList = Array.from(
    new Set(works.map((work) => work.series).filter((series): series is string => Boolean(series))),
  ).sort();
  const techniques = Array.from(
    new Set(
      works.map((work) => work.technique).filter((tech): tech is string => Boolean(tech)),
    ),
  ).sort();

  let filtered = works;
  if (annee) filtered = filtered.filter((work) => String(work.year) === annee);
  if (serie) filtered = filtered.filter((work) => work.series === serie);
  if (technique) filtered = filtered.filter((work) => work.technique === technique);

  const hasFilters = Boolean(annee || serie || technique);

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Œuvres récentes
      </h1>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <FiltersBar
          years={years}
          seriesList={seriesList}
          techniques={techniques}
          current={{ annee, serie, technique }}
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
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((work) => {
            const image = [...work.product_images].sort(
              (a, b) => a.position - b.position,
            )[0];

            return (
              <Link key={work.id} href={`/boutique/${work.id}`} className="group">
                <div className="aspect-square w-full overflow-hidden bg-zinc-50">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.url}
                      alt={work.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(45deg, #f0f0ee 0, #f0f0ee 2px, #ffffff 2px, #ffffff 12px)",
                      }}
                    />
                  )}
                </div>
                <p className="mt-3 text-sm font-medium">{work.title}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {[work.technique, work.year].filter(Boolean).join(" — ")}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
