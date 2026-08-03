import { NextResponse } from 'next/server';

/**
 * Fail-closed cron auth: CRON_SECRET must be set and match Bearer token.
 */
export function assertCronAuthorized(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: 'Cron not configured (CRON_SECRET missing)' },
      { status: 401 }
    );
  }
  const auth = request.headers.get('authorization') || '';
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
