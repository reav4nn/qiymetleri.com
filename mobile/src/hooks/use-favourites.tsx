import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AsyncStorage } from "expo-sqlite/kv-store";

const STORAGE_KEY = "qiymetleri:favourites";

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
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setIds(new Set(parsed.filter((v): v is string => typeof v === "string")));
      } catch { /* ignore */ }
    });
  }, []);

  const isFavourite = useCallback((id: string) => ids.has(id), [ids]);

  const toggleFavourite = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
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
