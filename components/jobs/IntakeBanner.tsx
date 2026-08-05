import Link from 'next/link';

export function IntakeBanner({
  source,
  summary,
  hasSchedule,
}: {
  source: string | null | undefined;
  summary?: string | null;
  hasSchedule: boolean;
}) {
  if (!source || (source !== 'ai_sms' && source !== 'ai_voice')) return null;
  if (hasSchedule) return null;

  const via = source === 'ai_sms' ? 'SMS' : 'phone';

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-semibold">
        Created by AI receptionist ({via}) — schedule this job
      </p>
      {summary ? (
        <p className="mt-1 text-amber-900/80">{summary}</p>
      ) : (
        <p className="mt-1 text-amber-900/80">
          No date yet. Set a time on the job or drag it on Calendar / Dispatch.
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-3">
        <Link
          href="/dashboard/calendar"
          className="font-semibold text-amber-950 underline-offset-2 hover:underline"
        >
          Open Calendar
        </Link>
        <Link
          href="/dashboard/dispatch"
          className="font-semibold text-amber-950 underline-offset-2 hover:underline"
        >
          Open Dispatch
        </Link>
      </div>
    </div>
  );
}
