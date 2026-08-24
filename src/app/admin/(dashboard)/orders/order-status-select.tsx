"use client";

import { useTransition } from "react";
import { updateOrderStatus } from "./actions";
import { ORDER_STATUS_LABELS, ORDER_STATUS_ORDER, ORDER_STATUS_STYLES, type OrderStatus } from "./status";

export function OrderStatusSelect({
  orderId,
  status,
  className,
}: {
  orderId: number;
  status: OrderStatus;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as OrderStatus;
    startTransition(() => {
      updateOrderStatus(orderId, next);
    });
  }

  return (
    <select
      value={status}
      onChange={handleChange}
      disabled={pending}
      aria-label="Statut de la commande"
      className={
        className ??
        `border-0 px-2 py-1 text-xs font-medium focus:outline-none disabled:opacity-50 ${ORDER_STATUS_STYLES[status]}`
      }
    >
      {ORDER_STATUS_ORDER.map((value) => (
        <option key={value} value={value}>
          {ORDER_STATUS_LABELS[value]}
        </option>
      ))}
    </select>
  );
}
