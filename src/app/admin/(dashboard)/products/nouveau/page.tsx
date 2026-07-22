import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrency } from "@/lib/settings";
import { SubmitButton } from "@/components/submit-button";
import { ProductFields } from "../product-fields";
import { createProduct } from "../actions";

export const metadata: Metadata = {
  title: "Ajouter un produit — Admin Blac_Kaleta",
};

export const maxDuration = 60;

export default async function NewProductPage() {
  const supabase = await createClient();
  const [{ data: categories }, { data: unclaimedMedia }, currency] = await Promise.all([
    supabase.from("categories").select("id, name").order("position", { ascending: true }),
    supabase
      .from("media")
      .select("id, filename, url")
      .is("product_id", null)
      .is("deleted_at", null)
      .in("kind", ["image", "gif"])
      .order("created_at", { ascending: false }),
    getCurrency(),
  ]);

  return (
    <div>
      <Link href="/admin/products" className="text-sm text-zinc-500 hover:underline">
        ← Produits
      </Link>
      <h1 className="mt-2 text-2xl font-semibold uppercase tracking-wide">
        Ajouter un produit
      </h1>

      <form
        action={createProduct}
        className="mt-6 flex flex-col gap-4 border border-zinc-200 bg-white p-6"
      >
        <ProductFields
          categories={categories ?? []}
          availableMedia={unclaimedMedia ?? []}
          currency={currency}
        />
        <SubmitButton
          pendingText="Ajout…"
          className="self-start bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Ajouter le produit
        </SubmitButton>
      </form>
    </div>
  );
}
