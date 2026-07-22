import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getCurrency } from "@/lib/settings";
import { formatPrice, type CurrencyCode } from "@/lib/currency";
import { Disclosure } from "@/components/disclosure";
import { SubmitButton } from "@/components/submit-button";
import { ProductFilters } from "./product-filters";
import { ProductRowActions } from "./product-row-actions";
import { SelectAllCheckbox } from "@/components/select-all-checkbox";
import { ImportCsvForm } from "./import-csv-form";
import {
  bulkProductAction,
  cycleProductStatus,
  deleteProduct,
  duplicateProduct,
  quickUpdateProduct,
  restoreProduct,
  toggleProductVisibility,
  trashProduct,
} from "./actions";
import { STATUS_LABELS, STATUS_ORDER, STATUS_STYLES, type ProductStatus } from "./status";

export const metadata: Metadata = {
  title: "Produits — Admin Blac_Kaleta",
};

export const maxDuration = 60;

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
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
  deleted_at: string | null;
  created_at: string;
  product_images: ProductImage[];
  product_categories: { categories: { id: number; name: string } | null }[];
};

function matchesStock(stock: number, filter: string) {
  if (filter === "en-stock") return stock > 0;
  if (filter === "faible") return stock > 0 && stock <= 2;
  if (filter === "epuise") return stock === 0;
  return true;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    recherche?: string;
    categorie?: string;
    stock?: string;
    statut?: string;
  }>;
}) {
  const {
    recherche = "",
    categorie = "toutes",
    stock = "tous",
    statut = "tous",
  } = await searchParams;
  const isTrashView = statut === "corbeille";
  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select(
      "id, title, price, stock, status, description, year, series, technique, is_for_sale, show_in_recent_works, featured_home, is_visible, deleted_at, created_at, product_images(id, path, url, position), product_categories(categories(id, name))",
    )
    .order("created_at", { ascending: false });

  query = isTrashView ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);

  if (recherche.trim()) {
    query = query.ilike("title", `%${recherche.trim()}%`);
  }

  const [
    { data: categories },
    { data: products, error },
    { count: allCount },
    { count: trashCount },
    currency,
  ] = await Promise.all([
    supabase.from("categories").select("id, name").order("position", { ascending: true }),
    query.returns<ProductRow[]>(),
    supabase.from("products").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),
    getCurrency(),
  ]);

  const categoryList = categories ?? [];

  let productList = products ?? [];

  const selectedCategoryId = categorie !== "toutes" ? Number(categorie) : null;
  if (selectedCategoryId) {
    productList = productList.filter((product) =>
      product.product_categories.some((pc) => pc.categories?.id === selectedCategoryId),
    );
  }
  productList = productList.filter((product) => matchesStock(product.stock, stock));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold uppercase tracking-wide">Produits</h1>
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
          <Link
            href="/admin/products/nouveau"
            className="bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            + Ajouter un produit
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <Link
          href="/admin/products"
          className={!isTrashView ? "font-semibold underline" : "text-zinc-600 hover:underline"}
        >
          Tous ({allCount ?? 0})
        </Link>
        <Link
          href="/admin/products"
          className={!isTrashView ? "font-semibold underline" : "text-zinc-600 hover:underline"}
        >
          Publiés ({allCount ?? 0})
        </Link>
        <Link
          href="/admin/products?statut=corbeille"
          className={isTrashView ? "font-semibold underline" : "text-zinc-600 hover:underline"}
        >
          Corbeille ({trashCount ?? 0})
        </Link>
      </div>

      <div className="mt-4">
        <ProductFilters
          search={recherche}
          category={categorie}
          stock={stock}
          categories={categoryList}
        />
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600">Erreur de chargement : {error.message}</p>
      ) : null}

      {productList.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucun produit ne correspond.</p>
      ) : (
        <>
          <form id="bulk-products-form" action={bulkProductAction} />
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <select
              name="bulk_action"
              form="bulk-products-form"
              defaultValue=""
              className="border border-zinc-300 px-2 py-2 text-sm"
            >
              <option value="" disabled>
                Actions groupées
              </option>
              {isTrashView ? (
                <>
                  <option value="restaurer">Restaurer</option>
                  <option value="supprimer">Supprimer définitivement</option>
                </>
              ) : (
                <option value="corbeille">Mettre à la corbeille</option>
              )}
            </select>
            <button
              type="submit"
              form="bulk-products-form"
              className="border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              Appliquer
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-2">
                    <SelectAllCheckbox formId="bulk-products-form" />
                  </th>
                  <th className="py-2 pr-4">Image</th>
                  <th className="py-2 pr-4">Nom</th>
                  <th className="py-2 pr-4">Stock</th>
                  <th className="py-2 pr-4">Prix</th>
                  <th className="py-2 pr-4">Catégorie</th>
                  <th className="py-2 pr-4">Date</th>
                </tr>
              </thead>
              <tbody>
              {productList.map((product) => {
                const images = [...product.product_images].sort(
                  (a, b) => a.position - b.position,
                );
                const categoryNames = product.product_categories
                  .map((pc) => pc.categories?.name)
                  .filter((name): name is string => Boolean(name));

                return (
                  <tr
                    key={product.id}
                    className={
                      product.is_visible
                        ? "group border-b border-zinc-100 align-top"
                        : "group border-b border-zinc-100 align-top opacity-50"
                    }
                  >
                    <td className="py-3 pr-2">
                      <input
                        type="checkbox"
                        name="ids"
                        value={product.id}
                        form="bulk-products-form"
                        aria-label={`Sélectionner ${product.title}`}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      {images[0] ? (
                        <Image
                          src={images[0].url}
                          alt={product.title}
                          width={48}
                          height={48}
                          className="h-12 w-12 object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 bg-zinc-100" />
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{product.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <form action={cycleProductStatus.bind(null, product.id, product.status)}>
                          <SubmitButton
                            pendingText="…"
                            className={`px-2 py-1 text-xs font-medium ${STATUS_STYLES[product.status]}`}
                          >
                            {STATUS_LABELS[product.status]}
                          </SubmitButton>
                        </form>
                        <form
                          action={toggleProductVisibility.bind(
                            null,
                            product.id,
                            product.is_visible,
                          )}
                        >
                          <SubmitButton
                            pendingText="…"
                            className={
                              product.is_visible
                                ? "px-2 py-1 text-xs font-medium bg-[#eef4ec] text-[#3a6b3a]"
                                : "px-2 py-1 text-xs font-medium bg-zinc-100 text-zinc-500"
                            }
                          >
                            {product.is_visible ? "Visible" : "Masqué"}
                          </SubmitButton>
                        </form>
                      </div>

                      <ProductRowActions
                        isTrash={isTrashView}
                        isVisible={product.is_visible}
                        productId={product.id}
                        onTrash={trashProduct.bind(null, product.id)}
                        onRestore={restoreProduct.bind(null, product.id)}
                        onDeletePermanently={deleteProduct.bind(null, product.id)}
                        onDuplicate={duplicateProduct.bind(null, product.id)}
                        quickEditForm={
                          <QuickEditForm product={product} currency={currency} />
                        }
                      />
                    </td>
                    <td className="py-3 pr-4">{product.stock}</td>
                    <td className="py-3 pr-4">
                      {product.price !== null ? formatPrice(product.price, currency) : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      {categoryNames.length > 0 ? categoryNames.join(", ") : "Sans catégorie"}
                    </td>
                    <td className="py-3 pr-4 text-zinc-500">
                      {dateFormatter.format(new Date(product.created_at))}
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function QuickEditForm({
  product,
  currency,
}: {
  product: ProductRow;
  currency: CurrencyCode;
}) {
  return (
    <form
      action={quickUpdateProduct.bind(null, product.id)}
      className="flex flex-wrap items-end gap-3 border border-zinc-200 bg-white p-4"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">Titre</label>
        <input
          name="title"
          defaultValue={product.title}
          required
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          Prix ({currency})
        </label>
        <input
          name="price"
          type="number"
          min="0"
          step="0.01"
          defaultValue={product.price ?? undefined}
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">Stock</label>
        <input
          name="stock"
          type="number"
          min="0"
          step="1"
          defaultValue={product.stock}
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">Statut</label>
        <select
          name="status"
          defaultValue={product.status}
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
        >
          {STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton
        pendingText="Enregistrement…"
        className="self-start bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Enregistrer
      </SubmitButton>
    </form>
  );
}
