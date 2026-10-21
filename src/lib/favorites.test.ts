import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FAVORITES_KEY,
  favoritesFirst,
  parseFavorites,
  useFavorites,
} from "./favorites.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  useFavorites.setState({ ids: [], storageUnavailable: false });
});

describe("favorite preferences", () => {
  it("validates version, schema, namespaces and corrupt data", () => {
    for (const input of [
      null,
      "invalid",
      "[]",
      '{"version":2,"ids":["format:mini"]}',
      '{"version":1,"ids":null}',
    ]) {
      expect(parseFavorites(input)).toEqual([]);
    }
    expect(
      parseFavorites(
        JSON.stringify({
          version: 1,
          ids: [
            "format:mini",
            "starter:address",
            "saved:local-id",
            "format:mini",
            "private:data",
            "format:",
            1,
            "saved:bad space",
            `saved:${"a".repeat(201)}`,
          ],
        }),
      ),
    ).toEqual(["format:mini", "starter:address", "saved:local-id"]);
  });

  it("puts favorites first without mutating catalogue or source order", () => {
    const items = Object.freeze([{ id: "a" }, { id: "b" }, { id: "c" }]);
    expect(
      favoritesFirst(items, "format", [
        "format:c",
        "format:b",
        "starter:a",
      ]).map((item) => item.id),
    ).toEqual(["b", "c", "a"]);
    expect(items.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("persists a versioned preference and toggles off without storing design data", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem });
    useFavorites.getState().toggle("format", "round");
    expect(setItem).toHaveBeenCalledWith(
      FAVORITES_KEY,
      '{"version":1,"ids":["format:round"]}',
    );
    expect(useFavorites.getState().ids).toEqual(["format:round"]);
    useFavorites.getState().toggle("format", "round");
    expect(useFavorites.getState().ids).toEqual([]);
  });

  it("keeps preferences usable and reports unavailable browser storage", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    expect(() =>
      useFavorites.getState().toggle("saved", "example"),
    ).not.toThrow();
    expect(useFavorites.getState().ids).toEqual(["saved:example"]);
    expect(useFavorites.getState().storageUnavailable).toBe(true);
  });
});
