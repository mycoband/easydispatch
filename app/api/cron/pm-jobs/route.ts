import { NextResponse } from 'next/server';
import { runPmJobAutomation } from '@/lib/agreements/run-pm-automation';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Vercel Cron: create due PM jobs for companies with PM automation on. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get('authorization') || '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await runPmJobAutomation();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('pm-jobs cron', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PM automation failed' },
      { status: 500 }
    );
  }
}
