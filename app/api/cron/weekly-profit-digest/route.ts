import { NextResponse } from 'next/server';
import { sendWeeklyProfitDigests } from '@/lib/reports/weekly-digest';
import { assertCronAuthorized } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Vercel Cron: weekly owner profit digest.
 * Requires CRON_SECRET (Authorization: Bearer …).
 */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  try {
    const result = await sendWeeklyProfitDigests();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('weekly-profit-digest', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Digest failed' },
      { status: 500 }
    );
  }
}
