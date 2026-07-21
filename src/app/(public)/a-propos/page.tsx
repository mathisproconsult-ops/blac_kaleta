import type { Metadata } from "next";
import { getPageBlocks } from "@/lib/page-blocks";
import { PageBlocks } from "@/components/page-blocks";

export const metadata: Metadata = {
  title: "À propos — Blac_Kaleta",
};

export default async function AboutPage() {
  const blocks = await getPageBlocks("a-propos");

  return (
    <div className="px-10 py-12">
      <PageBlocks blocks={blocks} />
    </div>
  );
}
