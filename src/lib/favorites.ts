import { create } from "zustand";

export const FAVORITES_KEY = "label-studio:favorites:v1";
const MAX_FAVORITES = 1000;
export type FavoriteKind = "format" | "starter" | "saved";

export function favoriteKey(kind: FavoriteKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseFavorites(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return [];
    const data = value as { version?: unknown; ids?: unknown };
    if (data.version !== 1 || !Array.isArray(data.ids)) return [];
    return [
      ...new Set(
        data.ids.filter(
          (id): id is string =>
            typeof id === "string" &&
            id.length <= 200 &&
            /^(format|starter|saved):[^\s]+$/.test(id),
        ),
      ),
    ].slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

function readFavorites(): string[] {
  try {
    return parseFavorites(localStorage.getItem(FAVORITES_KEY));
  } catch {
    return [];
  }
}

/** Stable partition: favorites first, preserving the catalogue's original order. */
export function favoritesFirst<T extends { id: string }>(
  items: readonly T[],
  kind: FavoriteKind,
  favorites: readonly string[],
): T[] {
  const selected = new Set(favorites);
  return [
    ...items.filter((item) => selected.has(favoriteKey(kind, item.id))),
    ...items.filter((item) => !selected.has(favoriteKey(kind, item.id))),
  ];
}

interface FavoritesState {
  ids: string[];
  storageUnavailable: boolean;
  toggle: (kind: FavoriteKind, id: string) => void;
}

export const useFavorites = create<FavoritesState>((set, get) => ({
  ids: readFavorites(),
  storageUnavailable: false,
  toggle: (kind, id) => {
    const key = favoriteKey(kind, id);
    const current = get().ids;
    const ids = current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key].slice(-MAX_FAVORITES);
    let storageUnavailable = false;
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify({ version: 1, ids }));
    } catch {
      storageUnavailable = true;
    }
    set({ ids, storageUnavailable });
  },
}));
