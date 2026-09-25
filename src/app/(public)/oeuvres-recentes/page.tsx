import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Œuvres récentes — Blac_Kaleta",
};

type Category = { id: number; name: string; cover_image_url: string | null };

export default async function RecentWorksPage() {
  const supabase = await createClient();
  // Best-effort : la table peut ne pas encore exister (migration 0031).
  const { data: categories } = await supabase
    .from("recent_work_categories")
    .select("id, name, cover_image_url")
    .order("position", { ascending: true })
    .returns<Category[]>();

  const categoryList = categories ?? [];

  // Requête séparée et best-effort : la colonne peut ne pas encore exister
  // si la migration 0034 n'a pas été appliquée — dans ce cas, aucun badge
  // +18 ne s'affiche plutôt que de faire échouer toute la page.
  const { data: ageRestrictedRows } = await supabase
    .from("recent_work_categories")
    .select("id, age_restricted");
  const ageRestrictedIds = new Set(
    ((ageRestrictedRows ?? []) as { id: number; age_restricted: boolean }[])
      .filter((row) => row.age_restricted)
      .map((row) => row.id),
  );

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <h1 className="text-2xl font-semibold uppercase tracking-wide">Œuvres récentes</h1>

      {categoryList.length === 0 ? (
        <p className="mt-12 text-sm text-zinc-500">Rien à afficher pour l&apos;instant.</p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {categoryList.map((category) => (
            <Link key={category.id} href={`/oeuvres-recentes/categorie/${category.id}`} className="group">
              <div className="relative aspect-square w-full overflow-hidden bg-zinc-50 dark:bg-zinc-900">
                {category.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={category.cover_image_url}
                    alt={category.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
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
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <p className="bg-white px-4 py-2 text-center text-sm font-medium uppercase tracking-wide dark:bg-zinc-900">
                    {category.name}
                  </p>
                </div>
                {ageRestrictedIds.has(category.id) ? (
                  <span className="absolute right-2 top-2 rounded bg-black/80 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
                    +18 · Contenu sensible
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
