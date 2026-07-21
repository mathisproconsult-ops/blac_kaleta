import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BlockType, PageBlock } from "@/lib/page-blocks";
import {
  addBlock,
  deleteBlock,
  moveBlock,
  updateTextBlock,
  uploadImageBlock,
} from "./actions";

const BLOCK_LABELS: Record<BlockType, string> = {
  titre: "Titre",
  texte: "Texte",
  image: "Image",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Page ${slug} — Admin Blac_Kaleta` };
}

export default async function PageEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: page } = await supabase
    .from("pages")
    .select("id, title")
    .eq("slug", slug)
    .maybeSingle();

  if (!page) notFound();

  const { data: blocks } = await supabase
    .from("page_blocks")
    .select("id, type, content, position")
    .eq("page_id", page.id)
    .order("position", { ascending: true })
    .returns<PageBlock[]>();

  const blockList = blocks ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">
        Contenu — {page.title}
      </h1>

      <div className="mt-6 flex gap-2">
        {(["titre", "texte", "image"] as BlockType[]).map((type) => (
          <form key={type} action={addBlock.bind(null, slug, type)}>
            <button
              type="submit"
              className="border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              + {BLOCK_LABELS[type]}
            </button>
          </form>
        ))}
      </div>

      {blockList.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Aucun bloc pour l&apos;instant.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {blockList.map((block, index) => (
            <li key={block.id} className="border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  {BLOCK_LABELS[block.type]}
                </p>
                <div className="flex items-center gap-3">
                  <form action={moveBlock.bind(null, block.id, slug, "up")}>
                    <button
                      type="submit"
                      disabled={index === 0}
                      aria-label="Monter"
                      className="text-xs text-zinc-500 hover:text-black disabled:opacity-20"
                    >
                      ▲
                    </button>
                  </form>
                  <form action={moveBlock.bind(null, block.id, slug, "down")}>
                    <button
                      type="submit"
                      disabled={index === blockList.length - 1}
                      aria-label="Descendre"
                      className="text-xs text-zinc-500 hover:text-black disabled:opacity-20"
                    >
                      ▼
                    </button>
                  </form>
                  <form
                    action={deleteBlock.bind(
                      null,
                      block.id,
                      slug,
                      block.type === "image" ? block.content.path ?? null : null,
                    )}
                  >
                    <button type="submit" className="text-sm text-red-600 hover:underline">
                      Supprimer
                    </button>
                  </form>
                </div>
              </div>

              {block.type === "image" ? (
                <form
                  action={uploadImageBlock.bind(
                    null,
                    block.id,
                    slug,
                    block.content.path ?? null,
                  )}
                  className="mt-3 flex flex-col gap-3"
                >
                  {block.content.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={block.content.url}
                      alt={block.content.alt ?? ""}
                      className="h-32 w-32 object-cover"
                    />
                  ) : (
                    <p className="text-sm text-zinc-500">Aucune image.</p>
                  )}
                  <input type="file" name="file" accept="image/*" className="text-sm" />
                  <input
                    name="alt"
                    placeholder="Texte alternatif (optionnel)"
                    defaultValue={block.content.alt ?? ""}
                    className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="self-start bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                  >
                    Enregistrer
                  </button>
                </form>
              ) : (
                <form
                  action={updateTextBlock.bind(null, block.id, slug)}
                  className="mt-3 flex flex-col gap-3"
                >
                  <textarea
                    name="text"
                    rows={block.type === "titre" ? 1 : 5}
                    defaultValue={block.content.text ?? ""}
                    className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="self-start bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                  >
                    Enregistrer
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
