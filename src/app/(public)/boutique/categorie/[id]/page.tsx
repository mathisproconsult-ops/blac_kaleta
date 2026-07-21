import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrency } from "@/lib/settings";
import { formatPrice } from "@/lib/currency";
import type { ProductStatus } from "@/app/admin/(dashboard)/products/status";
import { SortSelect } from "../../sort-select";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (id === "tous") return { title: "Boutique — Blac_Kaleta" };

  const supabase = await createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("name")
    .eq("id", id)
    .maybeSingle();

  return { title: category ? `${category.name} — Boutique — Blac_Kaleta` : "Boutique — Blac_Kaleta" };
}

export default async function BoutiqueCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tri?: string }>;
}) {
  const { id } = await params;
  const { tri = "default" } = await searchParams;
  const supabase = await createClient();

  const selectedCategoryId = id === "tous" ? null : Number(id);
  if (id !== "tous" && !Number.isInteger(selectedCategoryId)) notFound();

  const [{ data: categories }, { data: products }, currency] = await Promise.all([
    supabase.from("categories").select("id, name").order("position", { ascending: true }),
    supabase
      .from("products")
      .select(
        "id, title, price, status, product_images(url, position), product_categories(category_id)",
      )
      .eq("is_for_sale", true)
      .eq("is_visible", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .returns<ProductCard[]>(),
    getCurrency(),
  ]);

  const categoryList = categories ?? [];

  if (selectedCategoryId && !categoryList.some((category) => category.id === selectedCategoryId)) {
    notFound();
  }

  let productList = products ?? [];
  if (selectedCategoryId) {
    productList = productList.filter((product) =>
      product.product_categories.some((pc) => pc.category_id === selectedCategoryId),
    );
  }

  if (tri === "prix-asc") {
    productList = [...productList].sort(
      (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
    );
  } else if (tri === "prix-desc") {
    productList = [...productList].sort(
      (a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity),
    );
  }

  const currentCategory = selectedCategoryId
    ? categoryList.find((category) => category.id === selectedCategoryId)
    : null;

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <Link href="/boutique" className="text-sm text-zinc-500 hover:underline">
        ← Toutes les catégories
      </Link>
      <h1 className="mt-2 text-2xl font-semibold uppercase tracking-wide">
        {currentCategory ? currentCategory.name : "Boutique"}
      </h1>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-4">
          <Link
            href="/boutique/categorie/tous"
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
              href={`/boutique/categorie/${category.id}`}
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

        <SortSelect value={tri} basePath={`/boutique/categorie/${id}`} />
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
                    {product.price !== null ? formatPrice(product.price, currency) : "Sur demande"}
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
