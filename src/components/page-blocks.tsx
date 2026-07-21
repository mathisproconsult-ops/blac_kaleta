import type { PageBlock } from "@/lib/page-blocks";

export function PageBlocks({ blocks }: { blocks: PageBlock[] }) {
  return (
    <div className="flex flex-col items-center gap-8 text-center sm:items-start sm:text-left">
      {blocks.map((block) => {
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
              className="max-w-2xl whitespace-pre-line text-sm leading-relaxed text-zinc-700"
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
      })}
    </div>
  );
}
