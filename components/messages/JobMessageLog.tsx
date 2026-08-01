import { formatTimestamp } from '@/lib/jobs/time-tracking';

export type MessageRow = {
  id: string;
  channel: string | null;
  direction: string | null;
  to_address: string | null;
  body: string | null;
  status: string | null;
  created_at: string;
};

function kindLabel(status: string | null) {
  if (!status) return 'SMS';
  if (status.startsWith('omw:')) return 'On My Way';
  if (status.startsWith('reminder:')) return 'Reminder';
  if (status.startsWith('invoice:')) return 'Invoice';
  if (status.startsWith('text:')) return 'Text';
  return 'SMS';
}

function statusLabel(status: string | null) {
  if (!status) return '—';
  const part = status.includes(':') ? status.split(':').slice(1).join(':') : status;
  return part;
}

export function JobMessageLog({ messages }: { messages: MessageRow[] }) {
  return (
    <section className="panel p-5">
      <h2 className="font-display text-lg font-semibold text-ink-950">
        Message history
      </h2>
      <p className="mt-0.5 text-sm text-ink-500">
        Outbound SMS logged for this job
      </p>

      {messages.length === 0 ? (
        <p className="mt-4 text-sm text-ink-500">No messages yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className="rounded-lg border border-ink-100 bg-ink-50/70 px-3 py-2.5 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-ink-800">
                  {kindLabel(m.status)}
                </span>
                <span className="text-xs text-ink-400">
                  {formatTimestamp(m.created_at)} · {statusLabel(m.status)}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-500">
                To {m.to_address || '—'}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-ink-700">
                {m.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
