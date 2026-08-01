'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveJobSignature } from '@/app/tech/actions';

export function SignaturePad({
  jobId,
  existingName,
  existingData,
  signedAt,
}: {
  jobId: string;
  existingName?: string | null;
  existingData?: string | null;
  signedAt?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const router = useRouter();
  const [name, setName] = useState(existingName || '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#132b57';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function onUp() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }

  async function submit() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    const result = await saveJobSignature(jobId, {
      signatureData: canvas.toDataURL('image/png'),
      signatureName: name,
    });
    if (result.error) setError(result.error);
    else {
      setSuccess(result.success || 'Signed');
      router.refresh();
    }
    setPending(false);
  }

  if (existingData && signedAt) {
    return (
      <section className="panel p-5">
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Customer signature
        </h2>
        <p className="mt-1 text-sm text-emerald-700">
          Signed by {existingName || 'customer'} ·{' '}
          {new Date(signedAt).toLocaleString()}
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={existingData}
          alt="Customer signature"
          className="mt-3 max-h-40 w-full rounded-lg border border-ink-100 bg-white object-contain"
        />
      </section>
    );
  }

  return (
    <section className="panel p-5">
      <h2 className="font-display text-lg font-semibold text-ink-950">
        Customer signature
      </h2>
      <p className="mt-0.5 text-sm text-ink-500">
        Close-out: customer signs to complete the job
      </p>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium text-ink-700">
          Printed name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
          placeholder="Customer full name"
        />
      </label>

      <div className="mt-3 overflow-hidden rounded-xl border border-ink-200 bg-white">
        <canvas
          ref={canvasRef}
          className="h-40 w-full touch-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={clear}
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-700"
        >
          Clear
        </button>
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={submit}
          className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Sign & complete job'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {success && <p className="mt-2 text-sm text-emerald-700">{success}</p>}
    </section>
  );
}
