"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useProducts } from "./store";
import type { CartItem, Product } from "./types";

const CART_KEY = "los_cart_v1";

interface CartContextValue {
  items: CartItem[];
  count: number;
  addItem: (productId: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* keranjang rusak → mulai kosong */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, ready]);

  const value = useMemo<CartContextValue>(() => {
    const addItem = (productId: string, qty = 1) =>
      setItems((prev) => {
        const found = prev.find((i) => i.productId === productId);
        if (found) {
          return prev.map((i) =>
            i.productId === productId ? { ...i, qty: i.qty + qty } : i,
          );
        }
        return [...prev, { productId, qty }];
      });

    const setQty = (productId: string, qty: number) =>
      setItems((prev) =>
        qty <= 0
          ? prev.filter((i) => i.productId !== productId)
          : prev.map((i) => (i.productId === productId ? { ...i, qty } : i)),
      );

    const removeItem = (productId: string) =>
      setItems((prev) => prev.filter((i) => i.productId !== productId));

    const clearCart = () => setItems([]);

    return {
      items,
      count: items.reduce((a, i) => a + i.qty, 0),
      addItem,
      setQty,
      removeItem,
      clearCart,
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart harus dipakai di dalam CartProvider");
  return ctx;
}

/** isi keranjang yang sudah digabung dengan data produk (produk kosong dibuang) */
export function useCartLines(): { product: Product; qty: number }[] {
  const { items } = useCart();
  const products = useProducts();
  return useMemo(
    () =>
      items
        .map((i) => {
          const product = products.find((p) => p.id === i.productId);
          return product ? { product, qty: i.qty } : null;
        })
        .filter((l): l is { product: Product; qty: number } => l !== null),
    [items, products],
  );
}
