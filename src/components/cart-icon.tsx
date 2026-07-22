"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";

export function CartIcon() {
  const { totalCount } = useCart();

  return (
    <Link href="/panier" aria-label="Panier" className="relative text-lg">
      🛒
      {totalCount > 0 ? (
        <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-medium text-white">
          {totalCount}
        </span>
      ) : null}
    </Link>
  );
}
