import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPageBlocks } from "@/lib/page-blocks";
import { PageBlocks } from "@/components/page-blocks";

async function getPage(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pages")
    .select("id, title")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  return { title: page ? `${page.title} — Blac_Kaleta` : "Blac_Kaleta" };
}

export default async function CustomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPage(slug);

  if (!page) notFound();

  const blocks = await getPageBlocks(slug);

  return (
    <div className="px-10 py-12">
      <PageBlocks blocks={blocks} />
    </div>
  );
}
