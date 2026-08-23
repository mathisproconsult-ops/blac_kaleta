import type { PageBlock } from "@/lib/page-blocks";

function renderBlock(block: PageBlock) {
  if (block.type === "titre") {
    return (
      <h1
        key={block.id}
        className="text-2xl font-semibold uppercase tracking-wide"
      >
        {block.content.text ?? ""}
      </h1>
    );
  }

  if (block.type === "texte") {
    return (
      <p
        key={block.id}
        className="max-w-2xl whitespace-pre-line text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
      >
        {block.content.text ?? ""}
      </p>
    );
  }

  return (
    <div
      key={block.id}
      className="aspect-square w-full max-w-[560px]"
      style={
        !block.content.url
          ? {
              backgroundImage:
                "repeating-linear-gradient(45deg, #f0f0ee 0, #f0f0ee 2px, #ffffff 2px, #ffffff 12px)",
            }
          : undefined
      }
    >
      {block.content.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.content.url}
          alt={block.content.alt ?? ""}
          className="h-full w-full object-cover"
        />
      ) : null}
    </div>
  );
}

export function PageBlocks({ blocks }: { blocks: PageBlock[] }) {
  const imageBlock = blocks.find((block) => block.type === "image");

  if (!imageBlock) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 text-center sm:items-start sm:text-left">
        {blocks.map(renderBlock)}
      </div>
    );
  }

  const otherBlocks = blocks.filter((block) => block !== imageBlock);

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 text-center lg:grid lg:grid-cols-2 lg:items-center lg:gap-12 lg:text-left">
      <div className="w-full max-w-[560px] lg:max-w-none">{renderBlock(imageBlock)}</div>
      <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
        {otherBlocks.map(renderBlock)}
      </div>
    </div>
  );
}
