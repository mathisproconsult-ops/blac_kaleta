export const ORDER_STATUS_ORDER = ["new", "preparing", "shipped", "delivered"] as const;

export type OrderStatus = (typeof ORDER_STATUS_ORDER)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Nouvelle",
  preparing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
};

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  new: "bg-black text-white",
  preparing: "bg-zinc-100 text-zinc-700",
  shipped: "border border-zinc-300 text-zinc-700",
  delivered: "bg-[#eef4ec] text-[#3a6b3a]",
};
