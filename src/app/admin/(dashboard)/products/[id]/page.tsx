import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  technique_id: number | null;
  is_for_sale: boolean;
  show_in_recent_works: boolean;
  featured_home: boolean;
  product_images: ProductImage[];
  product_categories: { categories: { id: number; name: string } | null }[];
  product_option_groups: { group_id: number }[];
  source: string;
};

async function getProduct(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, title, price, stock, description, year, technique_id, is_for_sale, show_in_recent_works, featured_home, product_images(id, path, url, position), product_categories(categories(id, name))",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) console.error("getProduct", error);
  if (!data) return null;

  // Requête séparée et best-effort : si les tables du système d'options
  // n'existent pas encore (migration pas encore appliquée), la fiche
  // produit du dashboard doit quand même s'afficher.
  const { data: optionGroupRows, error: optionsError } = await supabase
    .from("product_option_groups")
    .select("group_id")
    .eq("product_id", data.id);

  if (optionsError) console.error("getProduct options", optionsError);

  // Requête séparée et best-effort : la colonne source peut ne pas encore
  // exister si la migration Printify (0028) n'a pas été appliquée.
  const { data: sourceRow } = await supabase
    .from("products")
    .select("source")
    .eq("id", data.id)
    .maybeSingle();

  return {
    ...data,
    product_option_groups: optionGroupRows ?? [],
    source: (sourceRow as { source: string } | null)?.source ?? "original",
  } as unknown as ProductDetail;
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

  const [
    product,
    { data: categories },
    { data: techniques },
    { data: unclaimedMedia },
    { data: optionGroups },
  ] = await Promise.all([
    getProduct(id),
    supabase.from("categories").select("id, name").order("position", { ascending: true }),
    supabase.from("techniques").select("id, name").order("position", { ascending: true }),
    supabase
      .from("media")
      .select("id, filename, url")
      .is("product_id", null)
      .is("deleted_at", null)
      .in("kind", ["image", "gif"])
      .order("created_at", { ascending: false }),
    supabase
      .from("option_groups")
      .select("id, name, selection_type")
      .order("position", { ascending: true }),
  ]);

  if (!product) notFound();

  const images = [...product.product_images].sort((a, b) => a.position - b.position);
  const selectedCategoryIds = product.product_categories
    .map((pc) => pc.categories?.id)
    .filter((categoryId): categoryId is number => typeof categoryId === "number");
  const selectedOptionGroupIds = product.product_option_groups.map((pog) => pog.group_id);

  return (
    <div>
      <Link href="/admin/products" className="text-sm text-zinc-500 hover:underline">
        ← Produits
      </Link>
      <h1 className="mt-2 text-2xl font-semibold uppercase tracking-wide">
        {product.title}
        {product.source === "printify" ? (
          <span className="ml-2 rounded bg-zinc-900 px-2 py-1 align-middle text-xs font-medium uppercase tracking-wide text-white dark:bg-zinc-100 dark:text-zinc-900">
            Printify
          </span>
        ) : null}
      </h1>

      {images.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {images.map((image) =>
            product.source === "printify" ? (
              <div key={image.id} className="relative">
                {/* Image hébergée sur le CDN Printify, hors des domaines
                autorisés pour next/image (next.config.ts) : <img> brut. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={product.title}
                  className="h-24 w-24 object-cover"
                />
                <form
                  action={deleteProductImage.bind(null, image.id, image.path)}
                  className="absolute -right-2 -top-2"
                >
                  <SubmitButton
                    pendingText="…"
                    aria-label="Supprimer la photo"
                    className="flex h-5 w-5 items-center justify-center bg-black text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    ×
                  </SubmitButton>
                </form>
              </div>
            ) : (
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
                    className="flex h-5 w-5 items-center justify-center bg-black text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    ×
                  </SubmitButton>
                </form>
              </div>
            ),
          )}
        </div>
      ) : null}

      <form
        action={updateProduct.bind(null, product.id)}
        className="mt-6 flex flex-col gap-4 border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <ProductFields
          categories={categories ?? []}
          techniques={techniques ?? []}
          defaultValues={{
            title: product.title,
            price: product.price,
            stock: product.stock,
            description: product.description,
            year: product.year,
            technique_id: product.technique_id,
            is_for_sale: product.is_for_sale,
            show_in_recent_works: product.show_in_recent_works,
            featured_home: product.featured_home,
          }}
          selectedCategoryIds={selectedCategoryIds}
          availableMedia={unclaimedMedia ?? []}
          optionGroups={optionGroups ?? []}
          selectedOptionGroupIds={selectedOptionGroupIds}
        />
        <SubmitButton
          pendingText="Enregistrement…"
          className="self-start bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Enregistrer les modifications
        </SubmitButton>
      </form>
    </div>
  );
}
