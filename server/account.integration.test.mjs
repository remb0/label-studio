// Runs the real API against MySQL. Skipped unless MYSQL_TEST_HOST is set
// (CI provides a MySQL service; locally: any disposable MySQL 8.4 database).
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import mysql from "mysql2/promise";
import { createApp } from "./app.mjs";

const host = process.env.MYSQL_TEST_HOST;
const skip = host ? false : "set MYSQL_TEST_HOST to run against MySQL";

test("account lifecycle against MySQL", { skip }, async (t) => {
  const pool = mysql.createPool({
    host,
    port: Number(process.env.MYSQL_TEST_PORT || 3306),
    user: process.env.MYSQL_TEST_USER || "root",
    password: process.env.MYSQL_TEST_PASSWORD || "",
    database: process.env.MYSQL_TEST_DATABASE || "label_studio_test",
    multipleStatements: true,
    charset: "utf8mb4",
  });
  const app = createApp({
    pool,
    env: {
      PUBLIC_APP_URL: "http://127.0.0.1:3022",
      ADMIN_EMAILS: "admin@example.nl",
    },
  });
  await app.migrate({ attempts: 1 });
  await pool.query(
    "delete from users; delete from rate_limits; delete from user_studio_data",
  );
  const server = createServer(app.handler).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    server.close();
    await pool.end();
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const jar = {};
  async function call(who, method, path, payload) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(jar[who] ? { Cookie: jar[who] } : {}),
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const cookie = response.headers.get("set-cookie");
    if (cookie) jar[who] = cookie.split(";")[0];
    return { status: response.status, body: await response.json() };
  }

  const reg = await call("a", "POST", "/api/auth/register", {
    email: "user@example.nl",
    password: "first-password",
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.is_admin, false);
  assert.ok(!/Secure/.test(jar.a), "no Secure flag on an http origin");

  // Second device signs in to the same account.
  assert.equal(
    (
      await call("b", "POST", "/api/auth/login", {
        email: "user@example.nl",
        password: "first-password",
      })
    ).status,
    200,
  );

  // Device A saves two labels and settings.
  const first = await call("a", "POST", "/api/account/sync", {
    labels: [
      { id: "one", updatedAt: 100, name: "One" },
      { id: "two", updatedAt: 100, name: "Two" },
    ],
    settings: {
      payload: { preferences: { theme: "amber" } },
      base_revision: null,
    },
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.settings.revision, 1);
  assert.equal(first.body.labels.length, 2);

  // Device B edits "one" with an older timestamp (ignored), deletes "two",
  // and sends settings based on a stale revision (conflict).
  const second = await call("b", "POST", "/api/account/sync", {
    labels: [{ id: "one", updatedAt: 50, name: "Stale" }],
    deleted: { two: 200 },
    settings: {
      payload: { preferences: { theme: "violet" } },
      base_revision: null,
    },
  });
  assert.equal(second.body.settings_conflict, true);
  assert.equal(second.body.settings.payload.preferences.theme, "amber");
  const labels = Object.fromEntries(second.body.labels.map((l) => [l.id, l]));
  assert.equal(labels.one.payload.name, "One");
  assert.equal(labels.two.payload, null);

  // Cursor-based incremental sync only returns later changes.
  const later = await call("a", "POST", "/api/account/sync", {
    since: second.body.cursor + 10_000,
  });
  assert.equal(later.body.labels.length, 0);

  // Password change keeps this session and signs out the other device.
  assert.equal(
    (
      await call("a", "POST", "/api/auth/password/change", {
        current_password: "wrong-password",
        password: "second-password",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("a", "POST", "/api/auth/password/change", {
        current_password: "first-password",
        password: "second-password",
      })
    ).status,
    200,
  );
  assert.equal((await call("a", "GET", "/api/auth/session")).status, 200);
  assert.equal((await call("b", "GET", "/api/auth/session")).status, 401);

  const exported = await call("a", "GET", "/api/account/export");
  assert.equal(exported.body.labels.length, 1);
  assert.deepEqual(Object.keys(exported.body.deleted_labels), ["two"]);

  // Moderation is admin-only.
  await call("a", "POST", "/api/printers/reports", {
    model_id: "p15",
    result: "works",
    browser: "Chrome",
    operating_system: "macOS",
    app_version: "test",
  });
  assert.equal((await call("a", "GET", "/api/admin/moderation")).status, 403);
  await call("admin", "POST", "/api/auth/register", {
    email: "admin@example.nl",
    password: "admin-password",
  });
  const queue = await call("admin", "GET", "/api/admin/moderation");
  assert.equal(queue.body.reports.length, 1);
  assert.equal(
    (
      await call("admin", "POST", "/api/admin/moderation", {
        kind: "report",
        id: queue.body.reports[0].id,
        status: "approved",
      })
    ).status,
    200,
  );
  const summary = await call("a", "GET", "/api/printers/compatibility");
  assert.equal(summary.body[0].model_id, "p15");

  // Legacy single-document data migrates on first sync.
  const legacy = await call("c", "POST", "/api/auth/register", {
    email: "legacy@example.nl",
    password: "legacy-password",
  });
  await pool.execute(
    "insert into user_studio_data (user_id, payload) values (?, ?)",
    [
      legacy.body.user.id,
      JSON.stringify({
        version: 2,
        library: { labels: [{ id: "old", updatedAt: 5, name: "Old" }] },
        preferences: { theme: "forest" },
      }),
    ],
  );
  const migrated = await call("c", "POST", "/api/account/sync", {});
  assert.equal(migrated.body.labels[0].payload.name, "Old");
  assert.equal(migrated.body.settings.payload.preferences.theme, "forest");

  // Deleting requires the password and removes everything.
  assert.equal(
    (await call("a", "POST", "/api/account/delete", { password: "nope-nope" }))
      .status,
    403,
  );
  assert.equal(
    (
      await call("a", "POST", "/api/account/delete", {
        password: "second-password",
      })
    ).status,
    200,
  );
  const [rows] = await pool.query(
    "select count(*) n from user_labels l join users u on u.id = l.user_id where u.email = 'user@example.nl'",
  );
  assert.equal(Number(rows[0].n), 0);
});
