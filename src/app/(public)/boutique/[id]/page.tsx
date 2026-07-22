import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrency } from "@/lib/settings";
import { formatPrice } from "@/lib/currency";
import { STATUS_LABELS, type ProductStatus } from "@/app/admin/(dashboard)/products/status";
import { ProductGallery } from "./product-gallery";
import { AddToCartControls } from "../add-to-cart-controls";

type ProductDetail = {
  id: number;
  title: string;
  price: number | null;
  status: ProductStatus;
  stock: number;
  description: string | null;
  product_images: { url: string; position: number }[];
  product_categories: { categories: { name: string } | null }[];
};

async function getProduct(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, title, price, status, stock, description, product_images(url, position), product_categories(categories(name))",
    )
    .eq("id", id)
    .eq("is_visible", true)
    .is("deleted_at", null)
    .maybeSingle();

  return data as ProductDetail | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  return { title: product ? `${product.title} — Blac_Kaleta` : "Blac_Kaleta" };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, currency] = await Promise.all([getProduct(id), getCurrency()]);

  if (!product) notFound();

  const images = [...product.product_images].sort((a, b) => a.position - b.position);
  const categoryNames = product.product_categories
    .map((pc) => pc.categories?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <div className="grid gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-2 lg:gap-10 lg:px-10 lg:py-12">
      <ProductGallery images={images} alt={product.title} />
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-semibold">
          {product.title}
          {product.status === "sold" ? (
            <span className="bg-[#c9702f] px-2 py-1 text-xs font-medium uppercase text-white">
              Vendu
            </span>
          ) : null}
        </h1>
        {product.price !== null ? (
          <p className="mt-2 text-lg">{formatPrice(product.price, currency)}</p>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">Pièce non destinée à la vente</p>
        )}

        <p className="mt-4 inline-block border border-zinc-300 px-3 py-1 text-sm">
          {STATUS_LABELS[product.status]}
        </p>

        {categoryNames.length > 0 ? (
          <p className="mt-4 text-sm text-zinc-600">
            Catégorie : {categoryNames.join(", ")}
          </p>
        ) : null}

        <div className="mt-6">
          {product.status === "available" && product.price !== null && product.stock > 0 ? (
            <AddToCartControls
              product={{
                id: product.id,
                title: product.title,
                price: product.price,
                stock: product.stock,
                image: images[0]?.url ?? null,
              }}
              variant="full"
            />
          ) : null}
        </div>

        {product.description ? (
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              À propos de cette pièce
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm text-zinc-700">
              {product.description}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
