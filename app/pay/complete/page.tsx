import Link from 'next/link';

export default async function PayCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const { job } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16">
      <div className="panel p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Payment received
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink-950">
          Thank you
        </h1>
        <p className="mt-3 text-sm text-ink-600">
          Your payment was submitted successfully. The office has been notified
          automatically.
        </p>
        {job && (
          <p className="mt-2 text-xs text-ink-400">Reference: {job.slice(0, 8)}</p>
        )}
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-800"
        >
          Done
        </Link>
      </div>
    </div>
  );
}
