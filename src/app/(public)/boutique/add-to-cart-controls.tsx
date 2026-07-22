"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-context";

type CartProduct = {
  id: number;
  title: string;
  price: number;
  stock: number;
  image: string | null;
};

export function AddToCartControls({
  product,
  variant = "full",
}: {
  product: CartProduct;
  variant?: "full" | "compact";
}) {
  const { items, addItem, removeItem } = useCart();
  const [quantity, setQuantity] = useState(1);

  if (product.stock <= 0) {
    return <p className="text-sm text-zinc-500">Épuisé</p>;
  }

  const inCart = items.find((item) => item.productId === product.id);
  const isUnique = product.stock === 1;

  function handleAdd(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    addItem(
      {
        productId: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        stock: product.stock,
      },
      isUnique ? 1 : quantity,
    );
  }

  function handleRemove(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    removeItem(product.id);
  }

  if (isUnique) {
    return inCart ? (
      <button
        type="button"
        onClick={handleRemove}
        className={
          variant === "compact"
            ? "border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50"
            : "border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        }
      >
        Retirer du panier
      </button>
    ) : (
      <button
        type="button"
        onClick={handleAdd}
        className={
          variant === "compact"
            ? "bg-black px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800"
            : "bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        }
      >
        Ajouter au panier
      </button>
    );
  }

  const remaining = product.stock - (inCart?.quantity ?? 0);

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleAdd}
        disabled={remaining <= 0}
        className="border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-40"
      >
        + Ajouter
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="number"
        min={1}
        max={Math.max(remaining, 1)}
        value={quantity}
        onChange={(event) =>
          setQuantity(
            Math.max(1, Math.min(Number(event.target.value) || 1, Math.max(remaining, 1))),
          )
        }
        className="w-20 border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
      />
      <button
        type="button"
        onClick={handleAdd}
        disabled={remaining <= 0}
        className="bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        Ajouter au panier
      </button>
      {inCart ? (
        <span className="text-xs text-zinc-500">
          {inCart.quantity} déjà dans le panier
        </span>
      ) : null}
    </div>
  );
}
