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
  updateProduct,
} from "./actions";
import { STATUS_LABELS, STATUS_STYLES, type ProductStatus } from "./status";

export const metadata: Metadata = {
  title: "Produits — Admin Blac_Kaleta",
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
  price: number;
  stock: number;
  status: ProductStatus;
  description: string | null;
  product_images: ProductImage[];
  product_categories: { categories: { id: number; name: string } | null }[];
};

export default async function ProductsPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: products, error }] = await Promise.all([
    supabase.from("categories").select("id, name").order("position", { ascending: true }),
    supabase
      .from("products")
      .select(
        "id, title, price, stock, status, description, product_images(id, path, url, position), product_categories(categories(id, name))",
      )
      .order("created_at", { ascending: false })
      .returns<ProductRow[]>(),
  ]);

  const categoryList = categories ?? [];
  const productList = products ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold uppercase tracking-wide">
          Produits
        </h1>
        <div className="flex items-center gap-3">
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
              <ProductFields categories={categoryList} />
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
              <li key={product.id} className="py-4">
                <div className="flex items-center gap-4">
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
                  <div className="flex-1">
                    <p className="text-sm font-medium">{product.title}</p>
                    <p className="text-xs text-zinc-500">
                      {categoryNames.length > 0 ? categoryNames.join(", ") : "Sans catégorie"}
                    </p>
                  </div>
                  <p className="w-20 text-sm">{priceFormatter.format(product.price)}</p>
                  <p className="w-16 text-sm text-zinc-600">Stock : {product.stock}</p>
                  <form action={cycleProductStatus.bind(null, product.id, product.status)}>
                    <button
                      type="submit"
                      className={`px-2 py-1 text-xs font-medium ${STATUS_STYLES[product.status]}`}
                    >
                      {STATUS_LABELS[product.status]}
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
                      }}
                      selectedCategoryIds={selectedCategoryIds}
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
