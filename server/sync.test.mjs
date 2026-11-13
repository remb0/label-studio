import test from "node:test";
import assert from "node:assert/strict";
import {
  adminEmails,
  legacySnapshotToChanges,
  parseSyncRequest,
} from "./sync.mjs";

const now = 1_800_000_000_000;

test("labels and deletions become one change list, newest wins", () => {
  const { changes } = parseSyncRequest(
    {
      labels: [
        { id: "a", updatedAt: 10, name: "A" },
        { id: "b", updatedAt: 10 },
      ],
      deleted: { b: 10, c: 5 },
    },
    now,
  );
  const byId = Object.fromEntries(changes.map((c) => [c.id, c]));
  assert.equal(JSON.parse(byId.a.payload).name, "A");
  assert.equal(byId.b.payload, null, "a deletion wins a tie");
  assert.equal(byId.c.payload, null);
});

test("rejects invalid ids, times and oversized input", () => {
  assert.throws(() =>
    parseSyncRequest({ labels: [{ id: "", updatedAt: 1 }] }, now),
  );
  assert.throws(() =>
    parseSyncRequest(
      { labels: [{ id: "x", updatedAt: now + 2 * 86_400_000 }] },
      now,
    ),
  );
  assert.throws(() =>
    parseSyncRequest(
      { labels: [{ id: "x", updatedAt: 1, big: "x".repeat(2_000_001) }] },
      now,
    ),
  );
  assert.throws(() => parseSyncRequest({ settings: { payload: [] } }, now));
  assert.throws(() => parseSyncRequest(null, now));
});

test("settings carry the base revision for conflict detection", () => {
  const { settings, since } = parseSyncRequest(
    { settings: { payload: { preferences: {} }, base_revision: 4 }, since: 99 },
    now,
  );
  assert.equal(settings.baseRevision, 4);
  assert.equal(since, 99);
});

test("legacy snapshots split into labels, tombstones and settings", () => {
  const { changes, settings } = legacySnapshotToChanges({
    version: 2,
    library: { labels: [{ id: "a", updatedAt: 3 }, { id: 7 }] },
    deletedLabels: { gone: 9 },
    preferences: { theme: "cyan" },
    mappingProfiles: [{ name: "x" }],
  });
  assert.deepEqual(
    changes.map((c) => [c.id, c.changedAt, c.payload === null]),
    [
      ["a", 3, false],
      ["gone", 9, true],
    ],
  );
  assert.equal(settings.preferences.theme, "cyan");
  assert.equal(settings.mappingProfiles.length, 1);
});

test("admin e-mail list is trimmed and case-insensitive", () => {
  assert.deepEqual([...adminEmails(" A@x.nl, b@y.nl ,")], ["a@x.nl", "b@y.nl"]);
});
