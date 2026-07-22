import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrency } from "@/lib/settings";
import { SubmitButton } from "@/components/submit-button";
import { ProductFields } from "../product-fields";
import { deleteProductImage, updateProduct } from "../actions";

export const maxDuration = 60;

type ProductImage = { id: number; path: string; url: string; position: number };
type ProductDetail = {
  id: number;
  title: string;
  price: number | null;
  stock: number;
  description: string | null;
  year: number | null;
  series: string | null;
  technique: string | null;
  is_for_sale: boolean;
  show_in_recent_works: boolean;
  featured_home: boolean;
  product_images: ProductImage[];
  product_categories: { categories: { id: number; name: string } | null }[];
};

async function getProduct(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, title, price, stock, description, year, series, technique, is_for_sale, show_in_recent_works, featured_home, product_images(id, path, url, position), product_categories(categories(id, name))",
    )
    .eq("id", id)
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
  return { title: product ? `${product.title} — Admin Blac_Kaleta` : "Admin Blac_Kaleta" };
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [product, { data: categories }, { data: unclaimedMedia }, currency] = await Promise.all([
    getProduct(id),
    supabase.from("categories").select("id, name").order("position", { ascending: true }),
    supabase
      .from("media")
      .select("id, filename, url")
      .is("product_id", null)
      .in("kind", ["image", "gif"])
      .order("created_at", { ascending: false }),
    getCurrency(),
  ]);

  if (!product) notFound();

  const images = [...product.product_images].sort((a, b) => a.position - b.position);
  const selectedCategoryIds = product.product_categories
    .map((pc) => pc.categories?.id)
    .filter((categoryId): categoryId is number => typeof categoryId === "number");

  return (
    <div>
      <Link href="/admin/products" className="text-sm text-zinc-500 hover:underline">
        ← Produits
      </Link>
      <h1 className="mt-2 text-2xl font-semibold uppercase tracking-wide">
        {product.title}
      </h1>

      {images.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {images.map((image) => (
            <div key={image.id} className="relative">
              <Image
                src={image.url}
                alt={product.title}
                width={100}
                height={100}
                className="h-24 w-24 object-cover"
              />
              <form
                action={deleteProductImage.bind(null, image.id, image.path)}
                className="absolute -right-2 -top-2"
              >
                <SubmitButton
                  pendingText="…"
                  aria-label="Supprimer la photo"
                  className="flex h-5 w-5 items-center justify-center bg-black text-xs text-white"
                >
                  ×
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      ) : null}

      <form
        action={updateProduct.bind(null, product.id)}
        className="mt-6 flex flex-col gap-4 border border-zinc-200 bg-white p-6"
      >
        <ProductFields
          categories={categories ?? []}
          defaultValues={{
            title: product.title,
            price: product.price,
            stock: product.stock,
            description: product.description,
            year: product.year,
            series: product.series,
            technique: product.technique,
            is_for_sale: product.is_for_sale,
            show_in_recent_works: product.show_in_recent_works,
            featured_home: product.featured_home,
          }}
          selectedCategoryIds={selectedCategoryIds}
          availableMedia={unclaimedMedia ?? []}
          currency={currency}
        />
        <SubmitButton
          pendingText="Enregistrement…"
          className="self-start bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Enregistrer les modifications
        </SubmitButton>
      </form>
    </div>
  );
}
