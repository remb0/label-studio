import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const response = (value: unknown, ok = true, status = 200) =>
  Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(value),
  } as Response);

describe("MySQL account API client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_ACCOUNT_API_URL", "/api");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("registers through the same-origin API without exposing a token", async () => {
    const fetchMock = vi.fn(() =>
      response({ user: { id: "user-1", email: "test@example.nl" } }, true, 201),
    );
    vi.stubGlobal("fetch", fetchMock);
    const account = await import("./cloud-account.ts");

    await expect(
      account.registerCloudAccount("test@example.nl", "safe-password"),
    ).resolves.toEqual({
      user: { id: "user-1", email: "test@example.nl", isAdmin: false },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({
          email: "test@example.nl",
          password: "safe-password",
        }),
      }),
    );
  });

  it("sends password recovery tokens only to the update endpoint", async () => {
    const fetchMock = vi.fn(() => response({ updated: true }));
    vi.stubGlobal("fetch", fetchMock);
    const account = await import("./cloud-account.ts");

    await account.updateCloudPassword("new-safe-password", "reset-token");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/password/update",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          password: "new-safe-password",
          token: "reset-token",
        }),
      }),
    );
  });
});

describe("account label merge", () => {
  const label = (id: string, updatedAt: number, name = id) => ({
    id,
    name,
    label: { widthMm: 40, heightMm: 30, dpi: 203 },
    elements: [],
    createdAt: 1,
    updatedAt,
  });

  it("keeps labels from both devices and the newest version of each", async () => {
    const { mergeLabelSets } = await import("./library.ts");
    const merged = mergeLabelSets(
      [label("a", 10, "local-a"), label("b", 5, "local-b")] as never,
      [label("b", 20, "remote-b"), label("c", 1)] as never,
      {},
    );
    expect(merged.map((l) => [l.id, l.name])).toEqual([
      ["b", "remote-b"],
      ["a", "local-a"],
      ["c", "c"],
    ]);
  });

  it("does not resurrect deleted labels unless edited after deletion", async () => {
    const { mergeLabelSets } = await import("./library.ts");
    const merged = mergeLabelSets(
      [] as never,
      [label("old", 10), label("edited-later", 30)] as never,
      { old: 15, "edited-later": 20 },
    );
    expect(merged.map((l) => l.id)).toEqual(["edited-later"]);
  });

  it("turns server rows into labels and tombstones, skipping invalid ones", async () => {
    vi.stubEnv("VITE_ACCOUNT_API_URL", "/api");
    const account = await import("./cloud-account.ts");
    const result = account.parseRemoteLabels([
      { id: "ok", changedAt: 7, payload: label("ok", 7) },
      { id: "bad", changedAt: 8, payload: { elements: "nope" } },
      { id: "gone", changedAt: 9, payload: null },
    ]);
    expect(result.skipped).toBe(1);
    expect(result.labels.map((l) => [l.id, l.updatedAt])).toEqual([["ok", 7]]);
    expect(result.deleted).toEqual({ gone: 9 });
  });

  it("splits large uploads into requests under the body limit", async () => {
    vi.stubEnv("VITE_ACCOUNT_API_URL", "/api");
    const account = await import("./cloud-account.ts");
    const labels = ["a", "b", "c"].map((id) => ({
      ...label(id, 1),
      name: id.repeat(300),
    }));
    const chunks = account.chunkLabels(labels as never, 1000);
    expect(chunks.map((c) => c.length)).toEqual([2, 1]);
  });
});
