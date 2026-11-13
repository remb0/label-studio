import { HttpError } from "./sync.mjs";

/**
 * Fixed-window rate limiter stored in MySQL, so every API replica shares the
 * same counters. One upsert per request; expired rows are pruned periodically.
 */
export function createRateLimiter(db) {
  async function hit(bucket, maximum, windowMs) {
    const key = bucket.slice(0, 255);
    // Assignments run left to right and see the old `reset_at` for both.
    await db.execute(
      `insert into rate_limits (bucket, hits, reset_at)
       values (?, 1, date_add(current_timestamp(3), interval ? microsecond)) as fresh
       on duplicate key update
         hits = if(rate_limits.reset_at <= current_timestamp(3), 1, rate_limits.hits + 1),
         reset_at = if(rate_limits.reset_at <= current_timestamp(3), fresh.reset_at, rate_limits.reset_at)`,
      [key, windowMs * 1000],
    );
    const [rows] = await db.execute(
      "select hits from rate_limits where bucket = ?",
      [key],
    );
    if (Number(rows[0]?.hits ?? 0) > maximum)
      throw new HttpError(429, "Te veel verzoeken. Probeer het later opnieuw.");
  }

  async function prune() {
    await db.query(
      "delete from rate_limits where reset_at < date_sub(current_timestamp(3), interval 1 hour)",
    );
  }

  return { hit, prune };
}
