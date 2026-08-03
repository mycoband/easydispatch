import { NextResponse } from 'next/server';
import { runPmJobAutomation } from '@/lib/agreements/run-pm-automation';
import { assertCronAuthorized } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Vercel Cron: create due PM jobs for companies with PM automation on. */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

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
