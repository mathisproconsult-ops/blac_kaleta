export const STATUS_ORDER = [
  "available",
  "out_of_stock",
  "reserved",
  "sold",
] as const;

export type ProductStatus = (typeof STATUS_ORDER)[number];

export const STATUS_LABELS: Record<ProductStatus, string> = {
  available: "Disponible",
  out_of_stock: "Épuisé",
  reserved: "Réservé",
  sold: "Vendu",
};

export const STATUS_STYLES: Record<ProductStatus, string> = {
  available: "bg-[#eef4ec] text-[#3a6b3a] dark:bg-[#16241a] dark:text-[#8fd18f]",
  out_of_stock: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  reserved: "bg-[#f5e6c8] text-[#8a6a1f] dark:bg-[#2e2410] dark:text-[#e0c27a]",
  sold: "bg-[#c9702f] text-white",
};
