"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "qiymetleri:favourites";

function loadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch { /* ignore corrupt data */ }
  return new Set();
}

function saveIds(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch { /* quota exceeded, etc. */ }
}

type FavouritesContextValue = {
  ids: Set<string>;
  isFavourite: (id: string) => boolean;
  toggleFavourite: (id: string) => void;
  count: number;
};

const FavouritesContext = createContext<FavouritesContextValue>({
  ids: new Set(),
  isFavourite: () => false,
  toggleFavourite: () => {},
  count: 0,
});

export function FavouritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(() => loadIds());

  // Sync across tabs
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) setIds(loadIds());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isFavourite = useCallback((id: string) => ids.has(id), [ids]);

  const toggleFavourite = useCallback((id: string) => {
    setIds((prev: Set<string>) => {
      const next = new Set<string>(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveIds(next);
      return next;
    });
  }, []);

  const value = useMemo<FavouritesContextValue>(
    () => ({ ids, isFavourite, toggleFavourite, count: ids.size }),
    [ids, isFavourite, toggleFavourite],
  );

  return (
    <FavouritesContext.Provider value={value}>
      {children}
    </FavouritesContext.Provider>
  );
}

export function useFavourites() {
  return useContext(FavouritesContext);
}
