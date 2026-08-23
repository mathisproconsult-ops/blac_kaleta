export const ORDER_STATUS_ORDER = ["new", "preparing", "shipped", "delivered"] as const;

export type OrderStatus = (typeof ORDER_STATUS_ORDER)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Nouvelle",
  preparing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
};

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  new: "bg-black text-white dark:bg-zinc-100 dark:text-zinc-900",
  preparing: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  shipped: "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300",
  delivered: "bg-[#eef4ec] text-[#3a6b3a] dark:bg-[#16241a] dark:text-[#8fd18f]",
};
