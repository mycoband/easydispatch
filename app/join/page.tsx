import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { SignOutButton } from '@/components/SignOutButton';

/** Team invite landing — prefills login signup, or explains if already signed in. */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const cleaned = (code || '').trim().toUpperCase();
  const { user } = await getSessionUser();

  if (!user) {
    const qs = new URLSearchParams({ mode: 'signup', join: '1' });
    if (cleaned) qs.set('invite', cleaned);
    redirect(`/login?${qs.toString()}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="panel w-full max-w-md space-y-4 p-6 sm:p-8">
        <h1 className="font-display text-xl font-semibold text-ink-950">
          You&apos;re already signed in
        </h1>
        <p className="text-sm text-ink-600">
          Join links are for <strong>new</strong> teammates. To add a technician
          yourself, use Settings → Team (no need to sign out).
        </p>
        {cleaned && (
          <p className="rounded-lg bg-ink-50 px-3 py-2 font-mono text-sm tracking-wider text-ink-800">
            Invite code: {cleaned}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/settings"
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Add team in Settings
          </Link>
          <SignOutButton />
        </div>
        <p className="text-xs text-ink-400">
          To test the join link as a tech: sign out, then open the link again —
          or use a private/incognito window.
        </p>
      </div>
    </main>
  );
}
