import { Star } from "lucide-react";
import {
  favoriteKey,
  useFavorites,
  type FavoriteKind,
} from "../lib/favorites.ts";

export function FavoriteButton({
  kind,
  id,
  name,
}: {
  kind: FavoriteKind;
  id: string;
  name: string;
}) {
  const active = useFavorites((state) =>
    state.ids.includes(favoriteKey(kind, id)),
  );
  const toggle = useFavorites((state) => state.toggle);
  const label = `${name} ${active ? "uit favorieten verwijderen" : "aan favorieten toevoegen"}`;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={() => toggle(kind, id)}
      className={`absolute top-1.5 right-1.5 z-10 flex size-8 items-center justify-center rounded-md border bg-ink-900/95 focus-visible:outline-2 focus-visible:outline-accent ${active ? "text-amber-300 border-amber-300/40" : "text-ink-400 border-white/10 hover:text-amber-300"}`}
    >
      <Star
        size={15}
        fill={active ? "currentColor" : "none"}
        aria-hidden="true"
      />
    </button>
  );
}

export function FavoritesStorageNotice() {
  const unavailable = useFavorites((state) => state.storageUnavailable);
  return unavailable ? (
    <p role="status" className="text-ui-xs text-amber-300 mt-2">
      Favorieten werken nu tijdelijk. Je browser kan ze niet bewaren na het
      sluiten.
    </p>
  ) : null;
}
