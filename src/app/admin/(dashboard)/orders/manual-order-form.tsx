"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { formatPrice } from "@/lib/currency";
import { SubmitButton } from "@/components/submit-button";
import { createManualOrder, type ManualOrderState } from "./actions";
import { ORDER_STATUS_LABELS, ORDER_STATUS_ORDER } from "./status";

type CustomerOption = { key: string; name: string; email: string | null };
type OptionChoice = { id: number; label: string; priceDelta: number };
type OptionGroup = { id: number; name: string; selectionType: "single" | "multiple"; choices: OptionChoice[] };
type ProductOption = { id: number; title: string; price: number; stock: number; groups: OptionGroup[] };

type Line = {
  key: string;
  label: string;
  unitPrice: number;
  quantity: number;
  data:
    | { type: "product"; productId: number; optionChoiceIds: number[] }
    | { type: "custom"; title: string; unitPrice: number };
};

const initialState: ManualOrderState = { success: false, error: null };

export function ManualOrderForm({
  customers,
  products,
  onCreated,
}: {
  customers: CustomerOption[];
  products: ProductOption[];
  onCreated?: () => void;
}) {
  const [state, formAction] = useActionState(createManualOrder, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [lines, setLines] = useState<Line[]>([]);

  const [selectedProductId, setSelectedProductId] = useState<number | "">("");
  const [singleSelections, setSingleSelections] = useState<Record<number, number>>({});
  const [multipleSelections, setMultipleSelections] = useState<Record<number, number[]>>({});
  const [productQuantity, setProductQuantity] = useState(1);

  const [customTitle, setCustomTitle] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQuantity, setCustomQuantity] = useState(1);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- réinitialise le panier local après une création réussie, pas une donnée dérivée d'un rendu
      setLines([]);
      onCreated?.();
    }
  }, [state.success, onCreated]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  function addProductLine() {
    if (!selectedProduct) return;

    const optionChoiceIds: number[] = [];
    const labelParts: string[] = [];
    let priceDelta = 0;

    for (const group of selectedProduct.groups) {
      if (group.selectionType === "single") {
        const choiceId = singleSelections[group.id] ?? group.choices[0]?.id;
        const choice = group.choices.find((entry) => entry.id === choiceId);
        if (choice) {
          optionChoiceIds.push(choice.id);
          labelParts.push(`${group.name} : ${choice.label}`);
          priceDelta += choice.priceDelta;
        }
      } else {
        for (const choiceId of multipleSelections[group.id] ?? []) {
          const choice = group.choices.find((entry) => entry.id === choiceId);
          if (choice) {
            optionChoiceIds.push(choice.id);
            labelParts.push(`${group.name} : ${choice.label}`);
            priceDelta += choice.priceDelta;
          }
        }
      }
    }

    setLines((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        label: labelParts.length > 0 ? `${selectedProduct.title} (${labelParts.join(", ")})` : selectedProduct.title,
        unitPrice: selectedProduct.price + priceDelta,
        quantity: productQuantity,
        data: { type: "product", productId: selectedProduct.id, optionChoiceIds },
      },
    ]);

    setSelectedProductId("");
    setSingleSelections({});
    setMultipleSelections({});
    setProductQuantity(1);
  }

  function addCustomLine() {
    const price = Number(customPrice);
    if (!customTitle.trim() || !Number.isFinite(price) || price < 0 || customQuantity <= 0) return;

    setLines((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        label: customTitle.trim(),
        unitPrice: price,
        quantity: customQuantity,
        data: { type: "custom", title: customTitle.trim(), unitPrice: price },
      },
    ]);

    setCustomTitle("");
    setCustomPrice("");
    setCustomQuantity(1);
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  const linesPayload = useMemo(
    () =>
      JSON.stringify(
        lines.map((line) =>
          line.data.type === "product"
            ? { type: "product", productId: line.data.productId, quantity: line.quantity, optionChoiceIds: line.data.optionChoiceIds }
            : { type: "custom", title: line.data.title, unitPrice: line.data.unitPrice, quantity: line.quantity },
        ),
      ),
    [lines],
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-6 border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold uppercase tracking-wide">Client</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="customerMode"
              value="existing"
              checked={customerMode === "existing"}
              onChange={() => setCustomerMode("existing")}
            />
            Client existant
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="customerMode"
              value="new"
              checked={customerMode === "new"}
              onChange={() => setCustomerMode("new")}
            />
            Nouveau client
          </label>
        </div>

        {customerMode === "existing" ? (
          <select
            name="customerKey"
            required={customerMode === "existing"}
            defaultValue=""
            className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          >
            <option value="" disabled>
              Choisir un client…
            </option>
            {customers.map((customer) => (
              <option key={customer.key} value={customer.key}>
                {customer.name}
                {customer.email ? ` — ${customer.email}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-zinc-500">Nom</label>
              <input
                name="newName"
                required={customerMode === "new"}
                className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-zinc-500">Email (facultatif)</label>
              <input
                name="newEmail"
                type="email"
                className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-zinc-500">Téléphone (facultatif)</label>
              <input
                name="newPhone"
                type="tel"
                className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
              />
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold uppercase tracking-wide">Articles</legend>

        {lines.length > 0 ? (
          <ul className="divide-y divide-zinc-100 border-y border-zinc-100 text-sm dark:divide-zinc-800 dark:border-zinc-800">
            {lines.map((line) => (
              <li key={line.key} className="flex items-center gap-3 py-2">
                <span className="flex-1">{line.label}</span>
                <span className="text-zinc-500">
                  {line.quantity} × {formatPrice(line.unitPrice)}
                </span>
                <span className="font-medium">{formatPrice(line.unitPrice * line.quantity)}</span>
                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Ajouter un produit du catalogue</p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <select
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value ? Number(event.target.value) : "")}
              className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
            >
              <option value="">Choisir un produit…</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.title} — {formatPrice(product.price)}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={productQuantity}
              onChange={(event) => setProductQuantity(Math.max(1, Number(event.target.value) || 1))}
              className="w-20 border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
            />
            <button
              type="button"
              onClick={addProductLine}
              disabled={!selectedProduct}
              className="border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Ajouter
            </button>
          </div>

          {selectedProduct && selectedProduct.groups.length > 0 ? (
            <div className="mt-3 flex flex-col gap-2">
              {selectedProduct.groups.map((group) =>
                group.selectionType === "single" ? (
                  <div key={group.id} className="flex flex-col gap-1">
                    <label className="text-xs uppercase tracking-wide text-zinc-500">{group.name}</label>
                    <select
                      value={singleSelections[group.id] ?? group.choices[0]?.id ?? ""}
                      onChange={(event) =>
                        setSingleSelections((current) => ({ ...current, [group.id]: Number(event.target.value) }))
                      }
                      className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
                    >
                      {group.choices.map((choice) => (
                        <option key={choice.id} value={choice.id}>
                          {choice.label}
                          {choice.priceDelta !== 0 ? ` (${choice.priceDelta > 0 ? "+" : ""}${formatPrice(choice.priceDelta)})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <fieldset key={group.id} className="flex flex-col gap-1">
                    <legend className="text-xs uppercase tracking-wide text-zinc-500">{group.name}</legend>
                    {group.choices.map((choice) => (
                      <label key={choice.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={(multipleSelections[group.id] ?? []).includes(choice.id)}
                          onChange={() =>
                            setMultipleSelections((current) => {
                              const existing = current[group.id] ?? [];
                              const next = existing.includes(choice.id)
                                ? existing.filter((id) => id !== choice.id)
                                : [...existing, choice.id];
                              return { ...current, [group.id]: next };
                            })
                          }
                        />
                        {choice.label}
                        {choice.priceDelta !== 0 ? ` (${choice.priceDelta > 0 ? "+" : ""}${formatPrice(choice.priceDelta)})` : ""}
                      </label>
                    ))}
                  </fieldset>
                ),
              )}
            </div>
          ) : null}
        </div>

        <div className="border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Ou ajouter une ligne libre (vente hors catalogue)
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-zinc-500">Nom</label>
              <input
                value={customTitle}
                onChange={(event) => setCustomTitle(event.target.value)}
                className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-zinc-500">Prix unitaire</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={customPrice}
                onChange={(event) => setCustomPrice(event.target.value)}
                className="w-32 border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-zinc-500">Quantité</label>
              <input
                type="number"
                min={1}
                value={customQuantity}
                onChange={(event) => setCustomQuantity(Math.max(1, Number(event.target.value) || 1))}
                className="w-20 border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
              />
            </div>
            <button
              type="button"
              onClick={addCustomLine}
              className="border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Ajouter
            </button>
          </div>
        </div>

        {lines.length > 0 ? (
          <p className="flex items-center justify-end gap-3 text-sm font-semibold">
            Total <span className="text-base">{formatPrice(total)}</span>
          </p>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">Statut</label>
          <select
            name="status"
            defaultValue="delivered"
            className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          >
            {ORDER_STATUS_ORDER.map((value) => (
              <option key={value} value={value}>
                {ORDER_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs uppercase tracking-wide text-zinc-500">
            Adresse de livraison (facultatif)
          </label>
          <input
            name="shippingAddress"
            className="w-full border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
          />
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <label className="text-xs uppercase tracking-wide text-zinc-500">
          Note (facultatif) — ex. « Vente en direct à l&apos;atelier »
        </label>
        <textarea
          name="note"
          rows={2}
          className="border border-zinc-300 px-3 py-2 text-sm focus:border-black focus:outline-none dark:border-zinc-700 dark:focus:border-zinc-100"
        />
      </div>

      <input type="hidden" name="lines" value={linesPayload} />

      <SubmitButton
        pendingText="Création…"
        disabled={lines.length === 0}
        className="self-start bg-black px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        Créer la commande
      </SubmitButton>

      {state.error ? (
        <p className="border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          ⚠ {state.error}
        </p>
      ) : state.success ? (
        <p className="border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          ✓ Commande créée.
        </p>
      ) : null}
    </form>
  );
}
