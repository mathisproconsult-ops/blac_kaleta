import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { formatPrice, formatIndicativeConversion } from "@/lib/currency";
import { deriveStatus, STATUS_LABELS, type ProductStatus } from "@/app/admin/(dashboard)/products/status";
import { BackButton } from "@/components/back-button";
import { ProductGallery } from "./product-gallery";
import { AddToCartControls } from "../add-to-cart-controls";
import { ProductOptionsPurchase } from "./product-options-purchase";

type ProductOptionChoice = { id: number; label: string; price_delta: number; position: number };
type ProductOptionGroupJoin = {
  group_id: number;
  option_groups: {
    id: number;
    name: string;
    selection_type: "single" | "multiple";
    position: number;
    option_choices: ProductOptionChoice[];
  } | null;
};

type ProductDetail = {
  id: number;
  title: string;
  price: number | null;
  status: ProductStatus;
  stock: number;
  description: string | null;
  product_images: { id: number; url: string; position: number }[];
  product_categories: { categories: { name: string } | null }[];
  product_option_groups: ProductOptionGroupJoin[];
  source: string;
};

async function getProduct(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, title, price, status, stock, description, product_images(id, url, position), product_categories(categories(name))",
    )
    .eq("id", id)
    .eq("is_visible", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) console.error("getProduct", error);
  if (!data) return null;

  // Requête séparée et best-effort : si les tables du système d'options
  // n'existent pas encore (migration pas encore appliquée) ou qu'une autre
  // erreur survient ici, la fiche produit doit quand même s'afficher.
  const { data: optionGroupRows, error: optionsError } = await supabase
    .from("product_option_groups")
    .select(
      "group_id, option_groups(id, name, selection_type, position, option_choices(id, label, price_delta, position))",
    )
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
  return { title: product ? `${product.title} — Blac_Kaleta` : "Blac_Kaleta" };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, settings] = await Promise.all([getProduct(id), getSettings()]);
  const { usd_rate: usdRate } = settings;

  if (!product) notFound();

  const sortedImages = [...product.product_images].sort((a, b) => a.position - b.position);

  // Requête séparée et best-effort : la colonne peut ne pas encore exister
  // (migration 0043) — sans elle, la fiche produit retombe simplement sur
  // l'image principale comme avant.
  const hqById = new Map<number, { url: string | null; width: number | null; height: number | null }>();
  if (sortedImages.length > 0) {
    const supabase = await createClient();
    const { data: hqRows } = await supabase
      .from("product_images")
      .select("id, high_quality_url, high_quality_width, high_quality_height")
      .in(
        "id",
        sortedImages.map((image) => image.id),
      );
    if (hqRows) {
      for (const row of hqRows as {
        id: number;
        high_quality_url: string | null;
        high_quality_width: number | null;
        high_quality_height: number | null;
      }[]) {
        hqById.set(row.id, {
          url: row.high_quality_url,
          width: row.high_quality_width,
          height: row.high_quality_height,
        });
      }
    }
  }

  const images = sortedImages.map((image) => {
    const hq = hqById.get(image.id);
    return {
      // url : taille principale, utilisée pour la bande de vignettes
      // sélectrices (pas besoin de haute résolution pour un sélecteur de
      // 64x64px). highQualityUrl : résolution/qualité supérieures,
      // réservée à l'image agrandie affichée — repli sur url si absente
      // (photo pas encore retraitée depuis la migration 0043).
      url: image.url,
      highQualityUrl: hq?.url ?? image.url,
      width: hq?.width ?? null,
      height: hq?.height ?? null,
    };
  });
  const categoryNames = product.product_categories
    .map((pc) => pc.categories?.name)
    .filter((name): name is string => Boolean(name));

  const optionGroups = product.product_option_groups
    .map((pog) => pog.option_groups)
    .filter((group): group is NonNullable<typeof group> => group !== null)
    .sort((a, b) => a.position - b.position)
    .map((group) => ({
      id: group.id,
      name: group.name,
      selectionType: group.selection_type,
      choices: [...group.option_choices]
        .sort((a, b) => a.position - b.position)
        .map((choice) => ({ id: choice.id, label: choice.label, priceDelta: choice.price_delta })),
    }))
    .filter((group) => group.choices.length > 0);

  // Filet de sécurité : dérivé du stock réel plutôt que de faire confiance
  // au statut stocké tel quel (voir deriveStatus dans products/status.ts —
  // la vraie correction empêche désormais les deux de diverger à
  // l'écriture, ceci garantit qu'un éventuel cas oublié ne se voit jamais
  // publiquement).
  const effectiveStatus = deriveStatus(product.status, product.stock);
  const isPurchasable =
    effectiveStatus === "available" && product.price !== null && product.stock > 0;

  return (
    <div className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <BackButton />
    <div className="mt-4 grid gap-8 lg:grid-cols-2 lg:gap-10">
      <ProductGallery
        images={images}
        alt={product.title}
        protectImages={product.source !== "printify"}
      />
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-semibold">
          {product.title}
          {effectiveStatus === "sold" ? (
            <span className="bg-[#c9702f] px-2 py-1 text-xs font-medium uppercase text-white">
              Vendu
            </span>
          ) : null}
        </h1>
        {isPurchasable && optionGroups.length > 0 ? null : product.price !== null ? (
          <>
            <p className="mt-2 text-lg" data-no-translate>{formatPrice(product.price)}</p>
            <p className="mt-1 text-sm text-zinc-400" data-no-translate>
              {formatIndicativeConversion(product.price, usdRate)}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">Pièce non destinée à la vente</p>
        )}

        <p className="mt-4 inline-block border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700">
          {STATUS_LABELS[effectiveStatus]}
        </p>

        {categoryNames.length > 0 ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Catégorie : {categoryNames.join(", ")}
          </p>
        ) : null}

        <div className="mt-6">
          {isPurchasable && optionGroups.length > 0 ? (
            <ProductOptionsPurchase
              product={{
                id: product.id,
                title: product.title,
                price: product.price as number,
                stock: product.stock,
                image: images[0]?.url ?? null,
              }}
              groups={optionGroups}
              usdRate={usdRate}
            />
          ) : isPurchasable ? (
            <AddToCartControls
              product={{
                id: product.id,
                title: product.title,
                price: product.price as number,
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
            <p className="mt-2 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
              {product.description}
            </p>
          </div>
        ) : null}
      </div>
    </div>
    </div>
  );
}
