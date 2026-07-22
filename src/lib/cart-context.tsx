"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  productId: number;
  title: string;
  price: number | null;
  image: string | null;
  stock: number;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity: number) => void;
  removeItem: (productId: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydratation unique du panier depuis localStorage au montage
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // Panier corrompu ou stockage indisponible : on repart d'un panier vide.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  function addItem(item: Omit<CartItem, "quantity">, quantity: number) {
    setItems((current) => {
      const existing = current.find((entry) => entry.productId === item.productId);
      if (existing) {
        const nextQuantity = Math.min(existing.quantity + quantity, item.stock);
        return current.map((entry) =>
          entry.productId === item.productId
            ? { ...entry, ...item, quantity: nextQuantity }
            : entry,
        );
      }
      return [...current, { ...item, quantity: Math.min(Math.max(quantity, 1), item.stock) }];
    });
  }

  function removeItem(productId: number) {
    setItems((current) => current.filter((entry) => entry.productId !== productId));
  }

  function setQuantity(productId: number, quantity: number) {
    setItems((current) =>
      current
        .map((entry) =>
          entry.productId === productId
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
