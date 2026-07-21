import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ProductStatus } from "@/app/admin/(dashboard)/products/status";
import { SortSelect } from "./sort-select";

export const metadata: Metadata = {
  title: "Boutique — Blac_Kaleta",
};

const priceFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

type ProductCard = {
  id: number;
  title: string;
  price: number | null;
  status: ProductStatus;
  product_images: { url: string; position: number }[];
  product_categories: { category_id: number }[];
};

const statusButtonLabel: Record<ProductStatus, string> = {
  available: "Acheter",
  reserved: "Réservé",
  sold: "Voir",
  out_of_stock: "Épuisé",
};

export default async function BoutiquePage({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string; tri?: string }>;
}) {
  const { categorie, tri = "default" } = await searchParams;
  const supabase = await createClient();

  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("id, name").order("position", { ascending: true }),
    supabase
      .from("products")
      .select(
        "id, title, price, status, product_images(url, position), product_categories(category_id)",
      )
      .eq("is_for_sale", true)
      .eq("is_visible", true)
      .order("created_at", { ascending: false })
      .returns<ProductCard[]>(),
  ]);

  const categoryList = categories ?? [];
  let productList = products ?? [];

  const selectedCategoryId = categorie ? Number(categorie) : null;
  if (selectedCategoryId) {
    productList = productList.filter((product) =>
      product.product_categories.some((pc) => pc.category_id === selectedCategoryId),
    );
  }

  // Les pièces sans prix sont affichées mais reléguées en fin de tri par prix.
  if (tri === "prix-asc") {
    productList = [...productList].sort(
      (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
    );
  } else if (tri === "prix-desc") {
    productList = [...productList].sort(
      (a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity),
    );
  }

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <h1 className="text-2xl font-semibold uppercase tracking-wide">Boutique</h1>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-4">
          <Link
            href="/boutique"
            className={
              !selectedCategoryId
                ? "text-sm font-semibold underline"
                : "text-sm text-zinc-600 hover:underline"
            }
          >
            Tous
          </Link>
          {categoryList.map((category) => (
            <Link
              key={category.id}
              href={`/boutique?categorie=${category.id}`}
              className={
                selectedCategoryId === category.id
                  ? "text-sm font-semibold underline"
                  : "text-sm text-zinc-600 hover:underline"
              }
            >
              {category.name}
            </Link>
          ))}
        </div>

        <SortSelect value={tri} />
      </div>

      {productList.length === 0 ? (
        <p className="mt-12 text-sm text-zinc-500">Aucun produit dans cette catégorie.</p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {productList.map((product) => {
            const image = [...product.product_images].sort(
              (a, b) => a.position - b.position,
            )[0];

            return (
              <Link key={product.id} href={`/boutique/${product.id}`} className="group">
                <div className="relative aspect-square w-full overflow-hidden bg-zinc-50">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.url}
                      alt={product.title}
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
                  {product.status === "sold" ? (
                    <span className="absolute right-2 top-2 bg-[#c9702f] px-2 py-1 text-xs font-medium uppercase text-white">
                      Vendu
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm font-medium">{product.title}</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-sm text-zinc-600">
                    {product.price !== null ? priceFormatter.format(product.price) : "Sur demande"}
                  </p>
                  <span className="text-xs uppercase tracking-wide text-zinc-500 group-hover:underline">
                    {product.price !== null ? statusButtonLabel[product.status] : "Voir"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
