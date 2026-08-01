'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  sendCustomJobSms,
  sendOmwSms,
} from '@/app/dashboard/messages/actions';

export function DispatchMessageButtons({
  jobId,
  phone,
}: {
  jobId: string;
  phone: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function run(kind: 'text' | 'omw') {
    if (!phone) return;
    setPending(kind);
    setFlash(null);
    const result =
      kind === 'omw'
        ? await sendOmwSms(jobId)
        : await sendCustomJobSms(
            jobId,
            `Hi, this is EasyDispatch following up about your service appointment. Reply or call us if you have questions.`
          );
    setFlash(result.error || result.success || null);
    setPending(null);
    if (!result.error) router.refresh();
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        <button
          type="button"
          disabled={!phone || Boolean(pending)}
          className="flex-1 rounded-lg border border-ink-200 bg-white py-1.5 text-[11px] font-medium text-sky-700 hover:bg-sky-50 disabled:text-ink-400"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            run('text');
          }}
        >
          {pending === 'text' ? '…' : 'Text'}
        </button>
        <button
          type="button"
          disabled={!phone || Boolean(pending)}
          className="flex-1 rounded-lg border border-ink-200 bg-white py-1.5 text-[11px] font-medium text-teal-700 hover:bg-teal-50 disabled:text-ink-400"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            run('omw');
          }}
          title={!phone ? 'Add customer phone for OMW' : 'Send On My Way SMS'}
        >
          {pending === 'omw' ? '…' : 'OMW'}
        </button>
      </div>
      {flash && (
        <p className="text-[10px] leading-snug text-ink-500">{flash}</p>
      )}
    </div>
  );
}
