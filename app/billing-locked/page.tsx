import Link from 'next/link';

export default function BillingLockedPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16">
      <div className="panel p-8 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-950">
          Subscription paused
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          Your company&apos;s EasyDispatch trial ended or billing needs
          attention. Ask the owner to update the plan in Settings → Billing.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/dashboard/settings/billing"
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Go to billing
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            Sign in as owner
          </Link>
        </div>
      </div>
    </div>
  );
}
