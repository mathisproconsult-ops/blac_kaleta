"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type SelectedOption = {
  groupId: number;
  groupName: string;
  choiceId: number;
  label: string;
  priceDelta: number;
};

export type CartItem = {
  productId: number;
  title: string;
  price: number | null;
  image: string | null;
  stock: number;
  quantity: number;
  selectedOptions: SelectedOption[];
};

function optionsKey(selectedOptions: SelectedOption[]) {
  return selectedOptions
    .map((option) => option.choiceId)
    .sort((a, b) => a - b)
    .join(",");
}

function sameLine(a: CartItem, b: Pick<CartItem, "productId" | "selectedOptions">) {
  return a.productId === b.productId && optionsKey(a.selectedOptions) === optionsKey(b.selectedOptions);
}

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity" | "selectedOptions"> & { selectedOptions?: SelectedOption[] }, quantity: number) => void;
  removeItem: (productId: number, selectedOptions?: SelectedOption[]) => void;
  setQuantity: (productId: number, quantity: number, selectedOptions?: SelectedOption[]) => void;
  clear: () => void;
  totalCount: number;
  subtotal: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "blac-kaleta-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydratation unique du panier depuis localStorage au montage
        setItems(
          parsed.map((entry) => ({ ...entry, selectedOptions: entry.selectedOptions ?? [] })),
        );
      }
    } catch {
      // Panier corrompu ou stockage indisponible : on repart d'un panier vide.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  function addItem(
    item: Omit<CartItem, "quantity" | "selectedOptions"> & { selectedOptions?: SelectedOption[] },
    quantity: number,
  ) {
    const selectedOptions = item.selectedOptions ?? [];
    setItems((current) => {
      const existing = current.find((entry) => sameLine(entry, { productId: item.productId, selectedOptions }));
      if (existing) {
        const nextQuantity = Math.min(existing.quantity + quantity, item.stock);
        return current.map((entry) =>
          entry === existing
            ? { ...entry, ...item, selectedOptions, quantity: nextQuantity }
            : entry,
        );
      }
      return [
        ...current,
        { ...item, selectedOptions, quantity: Math.min(Math.max(quantity, 1), item.stock) },
      ];
    });
  }

  function removeItem(productId: number, selectedOptions: SelectedOption[] = []) {
    setItems((current) =>
      current.filter((entry) => !sameLine(entry, { productId, selectedOptions })),
    );
  }

  function setQuantity(productId: number, quantity: number, selectedOptions: SelectedOption[] = []) {
    setItems((current) =>
      current
        .map((entry) =>
          sameLine(entry, { productId, selectedOptions })
            ? { ...entry, quantity: Math.max(1, Math.min(quantity, entry.stock)) }
            : entry,
        )
        .filter((entry) => entry.quantity > 0),
    );
  }

  function clear() {
    setItems([]);
  }

  const totalCount = items.reduce((sum, entry) => sum + entry.quantity, 0);
  const subtotal = items.reduce(
    (sum, entry) => sum + (entry.price ?? 0) * entry.quantity,
    0,
  );

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, setQuantity, clear, totalCount, subtotal }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
