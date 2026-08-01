import { NextResponse } from 'next/server';
import { sendWeeklyProfitDigests } from '@/lib/reports/weekly-digest';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Vercel Cron: weekly owner profit digest.
 * Secure with CRON_SECRET (Authorization: Bearer …) when set.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get('authorization') || '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

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
