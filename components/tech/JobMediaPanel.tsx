'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  deleteJobAttachment,
  markCustomerApproved,
  uploadJobAttachment,
} from '@/app/tech/actions';

type Attachment = {
  id: string;
  kind: string;
  tag: string | null;
  url: string | null;
  caption: string | null;
  created_at: string;
};

const PHOTO_TAGS = [
  { id: 'before', label: 'Before' },
  { id: 'after', label: 'After' },
  { id: 'nameplate', label: 'Nameplate' },
  { id: 'other', label: 'Other' },
] as const;

export function JobMediaPanel({
  jobId,
  attachments,
  customerApprovedAt,
  customerApprovedNote,
}: {
  jobId: string;
  attachments: Attachment[];
  customerApprovedAt?: string | null;
  customerApprovedNote?: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tag, setTag] = useState<(typeof PHOTO_TAGS)[number]['id']>('before');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function uploadFile(file: File, kind: 'photo' | 'voice', fileTag: string) {
    setPending(kind);
    setError(null);
    setMessage(null);
    const fd = new FormData();
    fd.set('file', file);
    fd.set('kind', kind);
    fd.set('tag', fileTag);
    const result = await uploadJobAttachment(jobId, fd);
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Saved');
      router.refresh();
    }
    setPending(null);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await uploadFile(file, 'photo', tag);
  }

  async function toggleVoice() {
    setError(null);
    if (recording && mediaRecorder.current) {
      mediaRecorder.current.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size) chunks.current.push(ev.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, {
          type: 'audio/webm',
        });
        await uploadFile(file, 'voice', 'voice');
      };
      mediaRecorder.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError('Microphone permission denied');
    }
  }

  async function approve() {
    setPending('approve');
    setError(null);
    const result = await markCustomerApproved(jobId);
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Logged');
      router.refresh();
    }
    setPending(null);
  }

  return (
    <section className="panel space-y-4 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Job photos
        </h2>
        <p className="mt-0.5 text-sm text-ink-500">
          Post before/after and nameplate shots here. Voice notes + verbal
          approval optional.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PHOTO_TAGS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTag(t.id)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              tag === t.id
                ? 'bg-brand-600 text-white'
                : 'border border-ink-200 bg-white text-ink-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={Boolean(pending)}
          onClick={() => fileRef.current?.click()}
          className="rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending === 'photo' ? 'Uploading…' : `Add ${tag} photo`}
        </button>
        <button
          type="button"
          disabled={Boolean(pending)}
          onClick={toggleVoice}
          className={`rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 ${
            recording ? 'bg-red-600' : 'bg-ink-800'
          }`}
        >
          {recording
            ? 'Stop recording'
            : pending === 'voice'
              ? 'Saving…'
              : 'Record voice note'}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />

      <button
        type="button"
        disabled={Boolean(pending) || Boolean(customerApprovedAt)}
        onClick={approve}
        className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 disabled:opacity-60"
      >
        {customerApprovedAt
          ? `Approved ${new Date(customerApprovedAt).toLocaleString()}`
          : pending === 'approve'
            ? 'Logging…'
            : 'Customer approved verbally'}
      </button>
      {customerApprovedNote && (
        <p className="text-xs text-ink-500">{customerApprovedNote}</p>
      )}

      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-start gap-3 rounded-xl border border-ink-100 p-2"
            >
              {a.kind === 'photo' && a.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.url}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover"
                />
              ) : a.kind === 'voice' && a.url ? (
                <audio controls src={a.url} className="min-w-0 flex-1" />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-ink-100" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium capitalize">
                  {a.tag || a.kind}
                </p>
                <p className="text-xs text-ink-400">
                  {new Date(a.created_at).toLocaleString()}
                </p>
                <button
                  type="button"
                  className="mt-1 text-xs text-red-700 hover:underline"
                  onClick={async () => {
                    await deleteJobAttachment(jobId, a.id);
                    router.refresh();
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}
    </section>
  );
}
