import type { Metadata } from "next";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Disclosure } from "@/components/disclosure";
import { ProductFields } from "./product-fields";
import { ImportCsvForm } from "./import-csv-form";
import {
  createProduct,
  cycleProductStatus,
  deleteProduct,
  deleteProductImage,
  toggleProductVisibility,
  updateProduct,
} from "./actions";
import { STATUS_LABELS, STATUS_STYLES, type ProductStatus } from "./status";

export const metadata: Metadata = {
  title: "Œuvres — Admin Blac_Kaleta",
};

export const maxDuration = 60;

const priceFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

type ProductImage = { id: number; path: string; url: string; position: number };
type ProductRow = {
  id: number;
  title: string;
  price: number | null;
  stock: number;
  status: ProductStatus;
  description: string | null;
  year: number | null;
  series: string | null;
  technique: string | null;
  is_for_sale: boolean;
  show_in_recent_works: boolean;
  featured_home: boolean;
  is_visible: boolean;
  product_images: ProductImage[];
  product_categories: { categories: { id: number; name: string } | null }[];
};

export default async function ProductsPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: products, error }, { data: unclaimedMedia }] =
    await Promise.all([
      supabase.from("categories").select("id, name").order("position", { ascending: true }),
      supabase
        .from("products")
        .select(
          "id, title, price, stock, status, description, year, series, technique, is_for_sale, show_in_recent_works, featured_home, is_visible, product_images(id, path, url, position), product_categories(categories(id, name))",
        )
        .order("created_at", { ascending: false })
        .returns<ProductRow[]>(),
      supabase
        .from("media")
        .select("id, filename, url")
        .is("product_id", null)
        .in("kind", ["image", "gif"])
        .order("created_at", { ascending: false }),
    ]);

  const categoryList = categories ?? [];
  const productList = products ?? [];
  const availableMedia = unclaimedMedia ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold uppercase tracking-wide">
          Œuvres
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- téléchargement de fichier, pas une navigation */}
          <a
            href="/admin/products/export"
            className="border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Exporter en CSV
          </a>
          <Disclosure label="Importer un CSV">
            <ImportCsvForm />
          </Disclosure>
          <Disclosure label="+ Ajouter un produit">
            <form
              action={createProduct}
              className="flex flex-col gap-4 border border-zinc-200 bg-white p-6"
            >
              <ProductFields categories={categoryList} availableMedia={availableMedia} />
              <button
                type="submit"
                className="self-start bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Ajouter le produit
              </button>
            </form>
          </Disclosure>
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600">
          Erreur de chargement : {error.message}
        </p>
      ) : null}

      {productList.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucun produit pour l&apos;instant.</p>
      ) : (
        <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-100">
          {productList.map((product) => {
            const images = [...product.product_images].sort(
              (a, b) => a.position - b.position,
            );
            const categoryNames = product.product_categories
              .map((pc) => pc.categories?.name)
              .filter((name): name is string => Boolean(name));
            const selectedCategoryIds = product.product_categories
              .map((pc) => pc.categories?.id)
              .filter((id): id is number => typeof id === "number");

            return (
              <li
                key={product.id}
                className={product.is_visible ? "py-4" : "py-4 opacity-50"}
              >
                <div className="flex flex-wrap items-center gap-3">
                  {images[0] ? (
                    <Image
                      src={images[0].url}
                      alt={product.title}
                      width={48}
                      height={48}
                      className="h-12 w-12 flex-none object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 flex-none bg-zinc-100" />
                  )}
                  <div className="min-w-[140px] flex-1">
                    <p className="text-sm font-medium">{product.title}</p>
                    <p className="text-xs text-zinc-500">
                      {categoryNames.length > 0 ? categoryNames.join(", ") : "Sans catégorie"}
                    </p>
                  </div>
                  <p className="text-sm">
                    {product.price !== null ? priceFormatter.format(product.price) : "—"}
                  </p>
                  <p className="text-sm text-zinc-600">Stock : {product.stock}</p>
                  <form action={cycleProductStatus.bind(null, product.id, product.status)}>
                    <button
                      type="submit"
                      className={`px-2 py-1 text-xs font-medium ${STATUS_STYLES[product.status]}`}
                    >
                      {STATUS_LABELS[product.status]}
                    </button>
                  </form>
                  <form
                    action={toggleProductVisibility.bind(
                      null,
                      product.id,
                      product.is_visible,
                    )}
                  >
                    <button
                      type="submit"
                      className={
                        product.is_visible
                          ? "px-2 py-1 text-xs font-medium bg-[#eef4ec] text-[#3a6b3a]"
                          : "px-2 py-1 text-xs font-medium bg-zinc-100 text-zinc-500"
                      }
                    >
                      {product.is_visible ? "Visible" : "Masqué"}
                    </button>
                  </form>
                  <form action={deleteProduct.bind(null, product.id)}>
                    <button type="submit" className="text-sm text-red-600 hover:underline">
                      Supprimer
                    </button>
                  </form>
                </div>

                <Disclosure label="Modifier" closeLabel="Fermer" className="mt-2">
                  {images.length > 0 ? (
                    <div className="mb-4 flex flex-wrap gap-3">
                      {images.map((image) => (
                        <div key={image.id} className="relative">
                          <Image
                            src={image.url}
                            alt={product.title}
                            width={80}
                            height={80}
                            className="h-20 w-20 object-cover"
                          />
                          <form
                            action={deleteProductImage.bind(null, image.id, image.path)}
                            className="absolute -right-2 -top-2"
                          >
                            <button
                              type="submit"
                              aria-label="Supprimer la photo"
                              className="flex h-5 w-5 items-center justify-center bg-black text-xs text-white"
                            >
                              ×
                            </button>
                          </form>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <form
                    action={updateProduct.bind(null, product.id)}
                    className="flex flex-col gap-4 border border-zinc-200 bg-white p-6"
                  >
                    <ProductFields
                      categories={categoryList}
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
                      availableMedia={availableMedia}
                    />
                    <button
                      type="submit"
                      className="self-start bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                    >
                      Enregistrer les modifications
                    </button>
                  </form>
                </Disclosure>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
