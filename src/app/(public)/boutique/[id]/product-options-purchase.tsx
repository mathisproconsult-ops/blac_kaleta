"use client";

import { useMemo, useState } from "react";
import { useCart, type SelectedOption } from "@/lib/cart-context";
import { formatPrice, formatIndicativeConversion } from "@/lib/currency";

type Choice = { id: number; label: string; priceDelta: number };
type Group = {
  id: number;
  name: string;
  selectionType: "single" | "multiple";
  choices: Choice[];
};

type Product = {
  id: number;
  title: string;
  price: number;
  stock: number;
  image: string | null;
};

export function ProductOptionsPurchase({
  product,
  groups,
  usdRate,
}: {
  product: Product;
  groups: Group[];
  usdRate: number;
}) {
  const { items, addItem, removeItem } = useCart();
  const [quantity, setQuantity] = useState(1);

  const [singleSelections, setSingleSelections] = useState<Record<number, number>>(() => {
    const initial: Record<number, number> = {};
    for (const group of groups) {
      if (group.selectionType === "single" && group.choices.length > 0) {
        initial[group.id] = group.choices[0].id;
      }
    }
    return initial;
  });
  const [multipleSelections, setMultipleSelections] = useState<Record<number, number[]>>({});

  const selectedOptions: SelectedOption[] = useMemo(() => {
    const result: SelectedOption[] = [];
    for (const group of groups) {
      if (group.selectionType === "single") {
        const choiceId = singleSelections[group.id];
        const choice = group.choices.find((entry) => entry.id === choiceId);
        if (choice) {
          result.push({
            groupId: group.id,
            groupName: group.name,
            choiceId: choice.id,
            label: `${group.name} : ${choice.label}`,
            priceDelta: choice.priceDelta,
          });
        }
      } else {
        const choiceIds = multipleSelections[group.id] ?? [];
        for (const choiceId of choiceIds) {
          const choice = group.choices.find((entry) => entry.id === choiceId);
          if (choice) {
            result.push({
              groupId: group.id,
              groupName: group.name,
              choiceId: choice.id,
              label: `${group.name} : ${choice.label}`,
              priceDelta: choice.priceDelta,
            });
          }
        }
      }
    }
    return result;
  }, [groups, singleSelections, multipleSelections]);

  const finalPrice =
    product.price + selectedOptions.reduce((sum, option) => sum + option.priceDelta, 0);

  const inCart = items.find(
    (item) =>
      item.productId === product.id &&
      item.selectedOptions.map((option) => option.choiceId).sort().join(",") ===
        selectedOptions.map((option) => option.choiceId).sort().join(","),
  );
  const remaining = product.stock - (inCart?.quantity ?? 0);

  function toggleMultipleChoice(groupId: number, choiceId: number) {
    setMultipleSelections((current) => {
      const existing = current[groupId] ?? [];
      const next = existing.includes(choiceId)
        ? existing.filter((id) => id !== choiceId)
        : [...existing, choiceId];
      return { ...current, [groupId]: next };
    });
  }

  function handleAdd() {
    addItem(
      {
        productId: product.id,
        title: product.title,
        price: finalPrice,
        image: product.image,
        stock: product.stock,
        selectedOptions,
      },
      product.stock === 1 ? 1 : quantity,
    );
  }

  function handleRemove() {
    removeItem(product.id, selectedOptions);
  }

  return (
    <div>
      <p className="text-lg">{formatPrice(finalPrice, "XOF")}</p>
      <p className="mt-1 text-sm text-zinc-400">
        {formatIndicativeConversion(finalPrice, usdRate)}
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {groups.map((group) =>
          group.selectionType === "single" ? (
            <div key={group.id} className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-zinc-500">
                {group.name}
              </label>
              <select
                value={singleSelections[group.id] ?? ""}
                onChange={(event) =>
                  setSingleSelections((current) => ({
                    ...current,
                    [group.id]: Number(event.target.value),
                  }))
                }
                className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
              >
                {group.choices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.label}
                    {choice.priceDelta !== 0
                      ? ` (${choice.priceDelta > 0 ? "+" : ""}${formatPrice(choice.priceDelta, "XOF")})`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <fieldset key={group.id} className="flex flex-col gap-1">
              <legend className="text-xs uppercase tracking-wide text-zinc-500">
                {group.name}
              </legend>
              <div className="flex flex-col gap-1">
                {group.choices.map((choice) => (
                  <label key={choice.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(multipleSelections[group.id] ?? []).includes(choice.id)}
                      onChange={() => toggleMultipleChoice(group.id, choice.id)}
                    />
                    {choice.label}
                    {choice.priceDelta !== 0
                      ? ` (${choice.priceDelta > 0 ? "+" : ""}${formatPrice(choice.priceDelta, "XOF")})`
                      : ""}
                  </label>
                ))}
              </div>
            </fieldset>
          ),
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {product.stock === 1 ? (
          inCart ? (
            <button
              type="button"
              onClick={handleRemove}
              className="border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              Retirer du panier
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAdd}
              className="bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Ajouter au panier
            </button>
          )
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
