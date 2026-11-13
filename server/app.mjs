import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import {
  hashToken,
  originAllowed,
  passwordHash,
  passwordMatches,
} from "./security.mjs";
import {
  HttpError,
  adminEmails,
  legacySnapshotToChanges,
  parseSyncRequest,
} from "./sync.mjs";
import { createRateLimiter } from "./rate-limit.mjs";

const sessionCookie = "label_studio_session";
const CURSOR_MARGIN_MS = 5000;

function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function cookieValue(request, name) {
  const cookies = Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((part) => part.trim().split(/=(.*)/s).slice(0, 2)),
  );
  return cookies[name] ? decodeURIComponent(cookies[name]) : null;
}

function validEmail(value) {
  const email = String(value || "")
    .trim()
    .toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320)
    throw new HttpError(400, "Vul een geldig e-mailadres in.");
  return email;
}

function validPassword(value) {
  const password = String(value || "");
  if (password.length < 8 || password.length > 200)
    throw new HttpError(400, "Gebruik een wachtwoord van 8 tot 200 tekens.");
  return password;
}

function text(value, maximum, required = false) {
  const result = String(value ?? "").trim();
  if (required && !result)
    throw new HttpError(400, "Vul alle verplichte velden in.");
  if (result.length > maximum) throw new HttpError(400, "Een veld is te lang.");
  return result || null;
}

async function body(request, maxBytes = 64 * 1024) {
  if (
    !String(request.headers["content-type"] || "").startsWith(
      "application/json",
    )
  )
    throw new HttpError(415, "Alleen JSON wordt ondersteund.");
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, "Verzoek is te groot.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new HttpError(400, "Ongeldige JSON.");
  }
}

function clientAddress(request) {
  return (
    String(request.headers["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() ||
    request.socket.remoteAddress ||
    "unknown"
  );
}

const UPSERT_LABEL = `insert into user_labels (user_id, label_id, payload, changed_at_ms)
  values (?, ?, ?, ?) as fresh
  on duplicate key update
    payload = if(
      fresh.changed_at_ms > user_labels.changed_at_ms
        or (fresh.changed_at_ms = user_labels.changed_at_ms and fresh.payload is null),
      fresh.payload, user_labels.payload),
    changed_at_ms = greatest(fresh.changed_at_ms, user_labels.changed_at_ms)`;

/**
 * Creates the account API. `env` defaults to process.env; tests pass their own
 * pool and environment.
 */
export function createApp({ pool, env = process.env, mail } = {}) {
  const sessionDays = Math.max(1, Number(env.SESSION_DAYS || 30));
  const publicUrl = (env.PUBLIC_APP_URL || "http://127.0.0.1:3022").replace(
    /\/$/,
    "",
  );
  const publicOrigin = new URL(publicUrl).origin;
  const production = env.NODE_ENV === "production";
  const allowedOrigins = new Set([
    publicOrigin,
    ...String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => new URL(value).origin),
  ]);
  // A Secure cookie is dropped on plain-HTTP origins (Safari/Firefox), which
  // makes login look successful while the session is never kept.
  const secureCookie = publicOrigin.startsWith("https://");
  const admins = adminEmails(env.ADMIN_EMAILS);
  const limiter = createRateLimiter(pool);
  const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_FROM);

  const sendMail =
    mail ??
    (async (message) => {
      const transport = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT || 587),
        secure: String(env.SMTP_SECURE || "false") === "true",
        auth: env.SMTP_USER
          ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
          : undefined,
      });
      await transport.sendMail({ from: env.SMTP_FROM, ...message });
    });

  function sessionHeader(token, maxAge = sessionDays * 86400) {
    const secure = secureCookie ? "; Secure" : "";
    return `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
  }

  function enforceSameOrigin(request) {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
    if (request.headers["sec-fetch-site"] === "cross-site")
      throw new HttpError(403, "Verzoek van een andere website geweigerd.");
    const origin = request.headers.origin;
    if (
      origin &&
      !originAllowed(origin, { allowed: allowedOrigins, dev: !production })
    )
      throw new HttpError(403, "Ongeldige herkomst.");
  }

  const rateLimit = (request, key, maximum, windowMs) =>
    limiter.hit(`${key}:${clientAddress(request)}`, maximum, windowMs);

  const publicUser = (user) => ({
    id: user.id,
    email: user.email,
    is_admin: admins.has(String(user.email).toLowerCase()),
  });

  async function sessionUser(request) {
    const token = cookieValue(request, sessionCookie);
    if (!token) return null;
    const [rows] = await pool.execute(
      `select u.id, u.email, u.password_hash from user_sessions s
       join users u on u.id = s.user_id
       where s.token_hash = ? and s.expires_at > current_timestamp limit 1`,
      [hashToken(token)],
    );
    return rows[0] ? { ...rows[0], token } : null;
  }

  async function requireUser(request) {
    const user = await sessionUser(request);
    if (!user) throw new HttpError(401, "Log eerst in.");
    return user;
  }

  async function requireAdmin(request) {
    const user = await requireUser(request);
    if (!publicUser(user).is_admin)
      throw new HttpError(403, "Alleen voor beheerders.");
    return user;
  }

  async function newSession(userId) {
    const token = randomBytes(32).toString("base64url");
    await pool.execute(
      "insert into user_sessions (token_hash, user_id, expires_at) values (?, ?, date_add(current_timestamp, interval ? day))",
      [hashToken(token), userId, sessionDays],
    );
    return token;
  }

  async function verifyPassword(user, password) {
    if (!(await passwordMatches(String(password || ""), user.password_hash)))
      throw new HttpError(403, "Het huidige wachtwoord is onjuist.");
  }

  /** Moves a pre-v3 single-document snapshot into per-label rows, once. */
  async function migrateLegacy(connection, userId) {
    const [rows] = await connection.execute(
      "select payload from user_studio_data where user_id = ? for update",
      [userId],
    );
    if (!rows[0]) return;
    const raw = rows[0].payload;
    const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
    const { changes, settings } = legacySnapshotToChanges(payload);
    for (const change of changes)
      await connection.execute(UPSERT_LABEL, [
        userId,
        change.id,
        change.payload,
        change.changedAt,
      ]);
    await connection.execute(
      "insert ignore into user_settings (user_id, payload) values (?, ?)",
      [userId, JSON.stringify(settings)],
    );
    await connection.execute("delete from user_studio_data where user_id = ?", [
      userId,
    ]);
  }

  async function accountState(userId, since) {
    const [[clock]] = await pool.query(
      "select cast(unix_timestamp(current_timestamp(3)) * 1000 as unsigned) as now_ms",
    );
    const [labels] = since
      ? await pool.execute(
          `select label_id, payload, changed_at_ms from user_labels
           where user_id = ? and server_updated_at > from_unixtime(? / 1000)`,
          [userId, since],
        )
      : await pool.execute(
          "select label_id, payload, changed_at_ms from user_labels where user_id = ?",
          [userId],
        );
    const [settings] = await pool.execute(
      "select payload, revision, updated_at from user_settings where user_id = ?",
      [userId],
    );
    const nowMs = Number(clock.now_ms);
    return {
      labels: labels.map((row) => ({
        id: row.label_id,
        changedAt: Number(row.changed_at_ms),
        payload: row.payload,
      })),
      settings: settings[0]
        ? {
            payload: settings[0].payload,
            revision: Number(settings[0].revision),
          }
        : null,
      // Rows committed by a slower concurrent request may carry a slightly
      // older timestamp; re-sending a few seconds of changes is harmless.
      cursor: Math.max(0, nowMs - CURSOR_MARGIN_MS),
      synced_at: new Date(nowMs).toISOString(),
    };
  }

  async function route(request, response) {
    const url = new URL(request.url, "http://localhost");
    enforceSameOrigin(request);
    const is = (method, path) =>
      request.method === method && url.pathname === path;

    if (is("GET", "/health")) return json(response, 200, { status: "ok" });

    if (is("POST", "/api/auth/register")) {
      await rateLimit(request, "register", 10, 15 * 60_000);
      const input = await body(request);
      const email = validEmail(input.email);
      const password = validPassword(input.password);
      const id = randomUUID();
      try {
        await pool.execute(
          "insert into users (id, email, password_hash) values (?, ?, ?)",
          [id, email, await passwordHash(password)],
        );
      } catch (error) {
        if (error?.code === "ER_DUP_ENTRY")
          throw new HttpError(
            409,
            "Er bestaat al een account voor dit e-mailadres.",
          );
        throw error;
      }
      const token = await newSession(id);
      return json(
        response,
        201,
        { user: publicUser({ id, email }) },
        { "Set-Cookie": sessionHeader(token) },
      );
    }

    if (is("POST", "/api/auth/login")) {
      await rateLimit(request, "login", 15, 15 * 60_000);
      const input = await body(request);
      const email = validEmail(input.email);
      const password = validPassword(input.password);
      const [rows] = await pool.execute(
        "select id, email, password_hash from users where email = ? limit 1",
        [email],
      );
      const user = rows[0];
      if (!user || !(await passwordMatches(password, user.password_hash)))
        throw new HttpError(401, "E-mailadres of wachtwoord is onjuist.");
      const token = await newSession(user.id);
      return json(
        response,
        200,
        { user: publicUser(user) },
        { "Set-Cookie": sessionHeader(token) },
      );
    }

    if (is("GET", "/api/auth/session")) {
      const user = await sessionUser(request);
      return user
        ? json(response, 200, { user: publicUser(user) })
        : json(response, 401, { error: "Geen actieve sessie." });
    }

    if (is("POST", "/api/auth/logout")) {
      const token = cookieValue(request, sessionCookie);
      if (token)
        await pool.execute("delete from user_sessions where token_hash = ?", [
          hashToken(token),
        ]);
      return json(
        response,
        200,
        { logged_out: true },
        { "Set-Cookie": sessionHeader("", 0) },
      );
    }

    if (is("POST", "/api/auth/password/request")) {
      await rateLimit(request, "password-reset", 5, 30 * 60_000);
      const email = validEmail((await body(request)).email);
      const [rows] = await pool.execute(
        "select id from users where email = ? limit 1",
        [email],
      );
      if (rows[0] && smtpConfigured) {
        const token = randomBytes(32).toString("base64url");
        await pool.execute(
          "insert into password_reset_tokens (token_hash, user_id, expires_at) values (?, ?, date_add(current_timestamp, interval 30 minute))",
          [hashToken(token), rows[0].id],
        );
        const link = `${publicUrl}/?reset_token=${encodeURIComponent(token)}`;
        await sendMail({
          to: email,
          subject: "Label Studio wachtwoord herstellen",
          text: `Open deze link om je wachtwoord te wijzigen: ${link}\n\nDe link is 30 minuten geldig.`,
        }).catch((error) =>
          console.error("Password-recovery email failed", error),
        );
      }
      return json(response, 202, {
        accepted: true,
        delivery_configured: smtpConfigured,
      });
    }

    if (is("POST", "/api/auth/password/update")) {
      await rateLimit(request, "password-update", 10, 30 * 60_000);
      const input = await body(request);
      const token = String(input.token || "");
      const password = String(input.password || "");
      if (password.length < 8 || password.length > 200 || !token)
        throw new HttpError(400, "Ongeldige of verlopen herstel-link.");
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.execute(
          "select user_id from password_reset_tokens where token_hash = ? and used_at is null and expires_at > current_timestamp for update",
          [hashToken(token)],
        );
        if (!rows[0])
          throw new HttpError(400, "Ongeldige of verlopen herstel-link.");
        await connection.execute(
          "update users set password_hash = ? where id = ?",
          [await passwordHash(password), rows[0].user_id],
        );
        await connection.execute(
          "update password_reset_tokens set used_at = current_timestamp where token_hash = ?",
          [hashToken(token)],
        );
        await connection.execute(
          "delete from user_sessions where user_id = ?",
          [rows[0].user_id],
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return json(
        response,
        200,
        { updated: true },
        { "Set-Cookie": sessionHeader("", 0) },
      );
    }

    if (is("POST", "/api/auth/password/change")) {
      await rateLimit(request, "password-change", 10, 30 * 60_000);
      const user = await requireUser(request);
      const input = await body(request);
      await verifyPassword(user, input.current_password);
      const password = validPassword(input.password);
      await pool.execute("update users set password_hash = ? where id = ?", [
        await passwordHash(password),
        user.id,
      ]);
      // Sign out every other device; keep this session.
      await pool.execute(
        "delete from user_sessions where user_id = ? and token_hash <> ?",
        [user.id, hashToken(user.token)],
      );
      return json(response, 200, { updated: true });
    }

    if (is("POST", "/api/account/sync")) {
      await rateLimit(request, "sync", 120, 15 * 60_000);
      const user = await requireUser(request);
      const { changes, settings, since } = parseSyncRequest(
        await body(request, 5_900_000),
      );
      let settingsConflict = false;
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await migrateLegacy(connection, user.id);
        for (const change of changes)
          await connection.execute(UPSERT_LABEL, [
            user.id,
            change.id,
            change.payload,
            change.changedAt,
          ]);
        if (settings) {
          const [rows] = await connection.execute(
            "select revision from user_settings where user_id = ? for update",
            [user.id],
          );
          const current = rows[0] ? Number(rows[0].revision) : null;
          if (current !== null && settings.baseRevision !== current)
            settingsConflict = true;
          else if (current === null)
            await connection.execute(
              "insert into user_settings (user_id, payload, revision) values (?, ?, 1)",
              [user.id, settings.payload],
            );
          else
            await connection.execute(
              "update user_settings set payload = ?, revision = revision + 1 where user_id = ?",
              [settings.payload, user.id],
            );
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return json(response, 200, {
        ...(await accountState(user.id, since)),
        settings_conflict: settingsConflict,
      });
    }

    if (is("GET", "/api/account/export")) {
      const user = await requireUser(request);
      const [[account]] = await pool.execute(
        "select email, created_at from users where id = ?",
        [user.id],
      );
      const state = await accountState(user.id, null);
      const [reports] = await pool.execute(
        "select model_id, result, browser, operating_system, firmware, notes, app_version, moderation_status, created_at from printer_compatibility_reports where user_id = ?",
        [user.id],
      );
      const [proposals] = await pool.execute(
        "select brand, model, connection_type, bluetooth_name, max_width_mm, dpi, media, product_url, operating_system, test_result, observations, moderation_status, created_at from printer_model_proposals where user_id = ?",
        [user.id],
      );
      return json(
        response,
        200,
        {
          format: "label-studio-account-export",
          version: 1,
          exported_at: new Date().toISOString(),
          account,
          labels: state.labels
            .filter((label) => label.payload !== null)
            .map((label) => label.payload),
          deleted_labels: Object.fromEntries(
            state.labels
              .filter((label) => label.payload === null)
              .map((label) => [label.id, label.changedAt]),
          ),
          settings: state.settings?.payload ?? null,
          printer_reports: reports,
          printer_proposals: proposals,
        },
        {
          "Content-Disposition":
            'attachment; filename="label-studio-account.json"',
        },
      );
    }

    if (is("POST", "/api/account/delete")) {
      await rateLimit(request, "account-delete", 5, 30 * 60_000);
      const user = await requireUser(request);
      await verifyPassword(user, (await body(request)).password);
      // Foreign keys cascade to sessions, labels, settings, reports and proposals.
      await pool.execute("delete from users where id = ?", [user.id]);
      return json(
        response,
        200,
        { deleted: true },
        { "Set-Cookie": sessionHeader("", 0) },
      );
    }

    if (is("GET", "/api/admin/moderation")) {
      await requireAdmin(request);
      const [reports] = await pool.query(
        `select id, model_id, result, connected, test_label_printed, size_alignment_checked,
           qr_scanned, reconnect_checked, browser, operating_system, firmware, notes,
           app_version, created_at
         from printer_compatibility_reports where moderation_status = 'pending'
         order by created_at limit 200`,
      );
      const [proposals] = await pool.query(
        `select id, brand, model, connection_type, bluetooth_name, max_width_mm, dpi, media,
           product_url, operating_system, test_result, observations, created_at
         from printer_model_proposals where moderation_status = 'pending'
         order by created_at limit 200`,
      );
      return json(response, 200, { reports, proposals });
    }

    if (is("POST", "/api/admin/moderation")) {
      await requireAdmin(request);
      const input = await body(request);
      if (!["approved", "rejected"].includes(input.status))
        throw new HttpError(400, "Ongeldige beoordeling.");
      const id = text(input.id, 36, true);
      const sql =
        input.kind === "report"
          ? "update printer_compatibility_reports set moderation_status = ?, reviewed_at = current_timestamp where id = ? and moderation_status = 'pending'"
          : input.kind === "proposal"
            ? "update printer_model_proposals set moderation_status = ? where id = ? and moderation_status = 'pending'"
            : null;
      if (!sql) throw new HttpError(400, "Ongeldig type.");
      const [result] = await pool.execute(sql, [input.status, id]);
      if (!result.affectedRows)
        throw new HttpError(404, "Niet gevonden of al beoordeeld.");
      return json(response, 200, { moderation_status: input.status });
    }

    if (is("GET", "/api/printers/compatibility")) {
      const [rows] = await pool.query(
        `select model_id,
          cast(sum(result = 'works') as unsigned) successful_reports,
          cast(sum(result = 'fails') as unsigned) failed_reports,
          count(*) approved_reports,
          max(created_at) last_tested_at
         from printer_compatibility_reports
         where moderation_status = 'approved'
         group by model_id`,
      );
      return json(response, 200, rows);
    }

    if (is("POST", "/api/printers/reports")) {
      await rateLimit(request, "printer-report", 30, 60 * 60_000);
      const user = await requireUser(request);
      const input = await body(request);
      if (!["works", "fails"].includes(input.result))
        throw new HttpError(400, "Ongeldig testresultaat.");
      await pool.execute(
        `insert into printer_compatibility_reports
         (id, user_id, model_id, result, connected, test_label_printed, size_alignment_checked, qr_scanned, reconnect_checked, browser, operating_system, firmware, notes, app_version)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          user.id,
          text(input.model_id, 120, true),
          input.result,
          Boolean(input.connected),
          Boolean(input.test_label_printed),
          Boolean(input.size_alignment_checked),
          Boolean(input.qr_scanned),
          Boolean(input.reconnect_checked),
          text(input.browser, 40, true),
          text(input.operating_system, 40, true),
          text(input.firmware, 120),
          text(input.notes, 1000),
          text(input.app_version, 80, true),
        ],
      );
      return json(response, 202, { moderation_status: "pending" });
    }

    if (is("POST", "/api/printers/proposals")) {
      await rateLimit(request, "printer-proposal", 20, 60 * 60_000);
      const user = await requireUser(request);
      const input = await body(request);
      const width =
        input.max_width_mm == null ? null : Number(input.max_width_mm);
      const dpi = input.dpi == null ? null : Number(input.dpi);
      if (
        width !== null &&
        (!Number.isFinite(width) || width < 1 || width > 500)
      )
        throw new HttpError(400, "Ongeldige labelbreedte.");
      if (dpi !== null && (!Number.isInteger(dpi) || dpi < 100 || dpi > 1200))
        throw new HttpError(400, "Ongeldige resolutie.");
      if (
        !["not-tested", "connected", "printed", "failed"].includes(
          input.test_result,
        )
      )
        throw new HttpError(400, "Ongeldig testresultaat.");
      const productUrl = text(input.product_url, 1000);
      if (productUrl) {
        try {
          if (!["http:", "https:"].includes(new URL(productUrl).protocol))
            throw new Error("protocol");
        } catch {
          throw new HttpError(400, "Ongeldige productlink.");
        }
      }
      await pool.execute(
        `insert into printer_model_proposals
         (id, user_id, brand, model, connection_type, bluetooth_name, max_width_mm, dpi, media, product_url, operating_system, test_result, observations)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          user.id,
          text(input.brand, 120, true),
          text(input.model, 120, true),
          text(input.connection_type, 60, true),
          text(input.bluetooth_name, 160),
          width,
          dpi,
          text(input.media, 500),
          productUrl,
          text(input.operating_system, 120),
          input.test_result,
          text(input.observations, 1000),
        ],
      );
      return json(response, 202, { moderation_status: "pending" });
    }

    throw new HttpError(404, "Niet gevonden.");
  }

  async function migrate({ attempts = 30 } = {}) {
    const schema = await readFile(
      new URL("./schema.sql", import.meta.url),
      "utf8",
    );
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await pool.query(schema);
        await pool.query(
          "delete from user_sessions where expires_at <= current_timestamp",
        );
        await pool.query(
          "delete from password_reset_tokens where expires_at <= current_timestamp or used_at is not null",
        );
        await limiter.prune();
        return;
      } catch (error) {
        if (attempt === attempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  function handler(request, response) {
    void route(request, response).catch((error) => {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error(error);
      if (response.headersSent) return response.end();
      json(response, status, {
        error: status === 500 ? "Interne serverfout." : error.message,
      });
    });
  }

  return {
    handler,
    migrate,
    prune: limiter.prune,
    warnings:
      production && !secureCookie
        ? [
            "PUBLIC_APP_URL is not HTTPS: session cookies are sent without the Secure flag.",
          ]
        : [],
  };
}
