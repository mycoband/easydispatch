/** Simple in-memory rate limit (per serverless instance). Good enough for v1. */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function intakeRateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const cur = buckets.get(opts.key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(opts.key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }
  if (cur.count >= opts.limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)),
    };
  }
  cur.count += 1;
  return { ok: true };
}
