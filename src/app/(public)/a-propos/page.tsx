import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "À propos — Blac_Kaleta",
};

export default function AboutPage() {
  return (
    <div className="grid gap-10 px-10 py-12 lg:grid-cols-[280px_1fr]">
      <div
        className="aspect-[3/4] w-full max-w-[280px]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #f0f0ee 0, #f0f0ee 2px, #ffffff 2px, #ffffff 12px)",
        }}
      />
      <div>
        <h1 className="text-2xl font-semibold uppercase tracking-wide">
          À propos
        </h1>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-zinc-700">
          Blac_Kaleta est un(e) artiste dont le travail explore la couleur,
          la matière et le mouvement à travers la peinture et le dessin.
          Chaque pièce est réalisée à la main dans un esprit d&apos;expérimentation
          constante.
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-700">
          (Texte à remplacer par la vraie biographie de l&apos;artiste.)
        </p>
      </div>
    </div>
  );
}
