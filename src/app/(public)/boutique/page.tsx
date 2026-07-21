import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Boutique — Blac_Kaleta",
};

type Category = { id: number; name: string; cover_image_url: string | null };

export default async function BoutiquePage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, cover_image_url")
    .order("position", { ascending: true })
    .returns<Category[]>();

  const categoryList = categories ?? [];

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <h1 className="text-2xl font-semibold uppercase tracking-wide">Boutique</h1>

      <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/boutique/categorie/tous" className="group">
          <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-zinc-900">
            <p className="px-4 text-center text-lg font-semibold uppercase tracking-wide text-white">
              Tous les produits
            </p>
          </div>
        </Link>

        {categoryList.map((category) => (
          <Link
            key={category.id}
            href={`/boutique/categorie/${category.id}`}
            className="group"
          >
            <div className="relative aspect-square w-full overflow-hidden bg-zinc-50">
              {category.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={category.cover_image_url}
                  alt={category.name}
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
                <p className="bg-white px-4 py-2 text-center text-sm font-medium uppercase tracking-wide">
                  {category.name}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
