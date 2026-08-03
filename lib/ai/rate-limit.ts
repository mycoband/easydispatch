import { createServiceClient } from '@/lib/supabase/admin';

const DEFAULT_LIMIT = 30;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export type AiRateLimitResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterSec: number };

/**
 * Per-user sliding-window limit for expensive AI routes.
 * Uses service-role inserts into ai_rate_events (see supabase/security-harden.sql).
 */
export async function assertAiRateLimit(
  userId: string,
  route: string,
  opts?: { limit?: number; windowMs?: number }
): Promise<AiRateLimitResult> {
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
  const since = new Date(Date.now() - windowMs).toISOString();

  try {
    const admin = createServiceClient();
    const { count, error: countError } = await admin
      .from('ai_rate_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since);

    if (countError) {
      // Table may not exist yet — fail open so deploy isn't bricked before SQL runs.
      console.warn('ai rate limit count failed:', countError.message);
      return { ok: true };
    }

    if (typeof count === 'number' && count >= limit) {
      return {
        ok: false,
        error: `AI rate limit reached (${limit}/hour). Try again later.`,
        retryAfterSec: Math.ceil(windowMs / 1000),
      };
    }

    const { error: insertError } = await admin.from('ai_rate_events').insert({
      user_id: userId,
      route,
    });
    if (insertError) {
      console.warn('ai rate limit insert failed:', insertError.message);
    }
    return { ok: true };
  } catch (err) {
    console.warn('ai rate limit error:', err);
    return { ok: true };
  }
}
