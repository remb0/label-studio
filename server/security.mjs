import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function passwordHash(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function passwordMatches(password, stored) {
  const [algorithm, n, r, p, salt, expected] = String(stored).split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const target = Buffer.from(expected, "base64");
  const actual = await scrypt(
    password,
    Buffer.from(salt, "base64"),
    target.length,
    {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 32 * 1024 * 1024,
    },
  );
  return actual.length === target.length && timingSafeEqual(actual, target);
}

/** Same-origin check; in development any loopback origin (Vite proxy) is accepted. */
export function originAllowed(origin, { allowed, dev }) {
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (allowed.has(parsed.origin)) return true;
  // Local development: Vite (any port) proxies /api to this server.
  return (
    dev &&
    ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) &&
    ["http:", "https:"].includes(parsed.protocol)
  );
}
