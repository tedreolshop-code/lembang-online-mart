"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { CATEGORIES } from "@/data/seed";
import { authHeaders, cloudMode } from "./auth";
import { CATEGORY_STORAGE_KEY, categorySlug, parseCategories, parseCategoryInput, sortCategories, type CategoryInput } from "./categories";
import type { Category } from "./types";

interface Snapshot {
  categories: Category[];
  ready: boolean;
  error: string;
}

function createCategoryStore(initial: Category[] | null) {
  // Store per provider: data SSR tidak dibagi antar-request atau browser.
  const serverSnapshot: Snapshot = { categories: initial ?? [], ready: initial !== null, error: "" };
  let snapshot = serverSnapshot;
  let pending: Promise<void> | null = null;
  let version = 0;
  const listeners = new Set<() => void>();
  const publish = (next: Snapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  const remember = (categories: Category[]) => {
    try { localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories)); } catch { /* mirror best-effort */ }
  };
  const readLocal = () => {
    const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
    return raw === null ? CATEGORIES : parseCategories(JSON.parse(raw));
  };
  const request = async (path: string, init?: RequestInit) => {
    const res = await fetch(path, { ...init, cache: "no-store", headers: {
      "Content-Type": "application/json", ...authHeaders(),
    } });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Kategori gagal dimuat. Silakan coba lagi.");
    return body;
  };
  const refresh = async () => {
    if (pending) return pending;
    const started = version;
    const run = async () => {
      try {
        const categories = cloudMode ? parseCategories(await request("/api/categories")) : readLocal();
        if (started !== version) return;
        publish({ categories, ready: true, error: "" });
        if (cloudMode) remember(categories);
      } catch (error) {
        if (started === version) publish({ ...snapshot, error: error instanceof Error ? error.message : "Kategori belum dapat dimuat." });
      }
    };
    pending = run();
    try { await pending; } finally { pending = null; }
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    refresh,
    start() {
      if (cloudMode && initial !== null) remember(initial);
      if (cloudMode && !snapshot.ready) {
        try {
          const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
          if (raw) publish({ categories: parseCategories(JSON.parse(raw)), ready: true, error: "" });
        } catch { /* refresh memulihkan mirror rusak */ }
      }
      void refresh();
      const interval = cloudMode ? setInterval(() => { void refresh(); }, 15000) : null;
      const onVisible = () => { if (!document.hidden) void refresh(); };
      const onStorage = (e: StorageEvent) => {
        if (!cloudMode && (e.key === CATEGORY_STORAGE_KEY || e.key === null)) void refresh();
      };
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("storage", onStorage);
      return () => {
        if (interval) clearInterval(interval);
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("storage", onStorage);
      };
    },
    async save(input: CategoryInput, slug?: string): Promise<Category> {
      const parsed = parseCategoryInput(input);
      let saved: Category;
      if (cloudMode) {
        saved = parseCategories([await request(slug ? `/api/categories/${encodeURIComponent(slug)}` : "/api/categories", {
          method: slug ? "PATCH" : "POST", body: JSON.stringify(parsed),
        })])[0];
      } else {
        const current = readLocal();
        const id = slug ?? categorySlug(parsed.name);
        if (!slug && current.some((category) => category.slug === id)) throw new Error("Kategori dengan nama tersebut sudah ada. Gunakan nama lain.");
        if (slug && !current.some((category) => category.slug === slug)) throw new Error("Kategori tidak ditemukan. Muat ulang daftar kategori.");
        saved = { slug: id, ...parsed };
        const categories = sortCategories([...current.filter((category) => category.slug !== id), saved]);
        // Penulisan lokal harus berhasil sebelum UI menampilkan sukses.
        localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories));
        version++;
        publish({ categories, ready: true, error: "" });
        return saved;
      }
      version++;
      const categories = sortCategories([...snapshot.categories.filter((category) => category.slug !== saved.slug), saved]);
      publish({ categories, ready: true, error: "" });
      remember(categories);
      return saved;
    },
  };
}

const CategoryContext = createContext<ReturnType<typeof createCategoryStore> | null>(null);

export function CategoryProvider({ initial, children }: { initial: Category[] | null; children: ReactNode }) {
  const [store] = useState(() => createCategoryStore(initial));
  useEffect(() => store.start(), [store]);
  return <CategoryContext.Provider value={store}>{children}</CategoryContext.Provider>;
}

export function useCategoryCatalog() {
  const store = useContext(CategoryContext);
  if (!store) throw new Error("Kategori harus berada di dalam CategoryProvider");
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { ...snapshot, refresh: store.refresh, saveCategory: store.save };
}

export function useCategories(): Category[] {
  return useCategoryCatalog().categories;
}
