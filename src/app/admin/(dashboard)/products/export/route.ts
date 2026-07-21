import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ExportRow = {
  title: string;
  price: number | null;
  stock: number;
  status: string;
  description: string | null;
  product_images: { url: string; position: number }[] | null;
  product_categories: { categories: { name: string } | null }[] | null;
};

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "title, price, stock, status, description, product_images(url, position), product_categories(categories(name))",
    )
    .order("created_at", { ascending: false })
    .returns<ExportRow[]>();

  const products = data ?? [];

  const rows = products.map((product) => {
    const images = [...(product.product_images ?? [])].sort(
      (a, b) => a.position - b.position,
    );
    const categories = (product.product_categories ?? [])
      .map((pc) => pc.categories?.name)
      .filter((name): name is string => Boolean(name));

    return {
      Name: product.title,
      "Regular price": product.price ?? "",
      Stock: product.stock,
      Status: product.status,
      Description: product.description ?? "",
      Categories: categories.join(", "),
      Images: images.map((image) => image.url).join(", "),
    };
  });

  const csv = Papa.unparse(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=produits-blac-kaleta.csv",
    },
  });
}
