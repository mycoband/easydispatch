'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  beginWalkthroughMediaUpload,
  completeWalkthroughMediaUpload,
  deleteWalkthroughMedia,
  saveWalkthroughDraft,
  saveWalkthroughToJob,
  transcribeWalkthroughVoice,
  uploadWalkthroughMedia,
} from '@/app/tech/walkthrough-actions';
import { setTechJobPhase } from '@/lib/tech/advance-phase';
import { DIRECT_UPLOAD_THRESHOLD_BYTES } from '@/lib/media/upload-limits';
import { createClient } from '@/lib/supabase/client';
import {
  computeWalkthroughTotals,
  WALKTHROUGH_STATUS_LABELS,
  type JobWalkthrough,
  type WalkthroughAttachment,
  type WalkthroughPart,
  type WalkthroughStatus,
} from '@/lib/jobs/walkthrough';
import {
  extractVideoFrames,
  frameCaption,
  isWalkthroughFrameCaption,
} from '@/lib/media/extract-video-frames';

function statusBadgeClass(status: WalkthroughStatus): string {
  switch (status) {
    case 'in_progress':
      return 'border-amber-200 bg-amber-50 text-amber-900';
    case 'generated':
      return 'border-sky-200 bg-sky-50 text-sky-900';
    case 'saved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    default:
      return 'border-ink-200 bg-ink-50 text-ink-600';
  }
}

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function reportFromWalkthrough(w: JobWalkthrough) {
  return {
    findings: w.findings || '',
    work_performed: w.work_performed || '',
    recommendations: w.recommendations || '',
    customer_summary: w.customer_summary || '',
    parts:
      w.parts.length > 0
        ? w.parts.map((p) => ({ ...p }))
        : ([] as WalkthroughPart[]),
    labor_hours: w.labor_hours,
    labor_rate: w.labor_rate,
  };
}

function hasReportContent(w: {
  findings: string;
  work_performed: string;
  recommendations: string;
  customer_summary: string;
  parts: WalkthroughPart[];
  labor_hours: number | null;
}): boolean {
  return (
    Boolean(w.findings.trim()) ||
    Boolean(w.work_performed.trim()) ||
    Boolean(w.recommendations.trim()) ||
    Boolean(w.customer_summary.trim()) ||
    w.parts.some((p) => p.name.trim()) ||
    w.labor_hours != null
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1 block text-sm font-medium text-ink-700">
      {children}
    </span>
  );
}

function SavedBlock({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const text = value?.trim();
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-ink-800">{text}</p>
    </div>
  );
}

export function JobWalkthroughPanel({
  jobId,
  walkthrough,
  media = [],
  canEdit = true,
  canMedia = true,
  allowTranscribe = false,
  allowGenerate = false,
  allowPdf = false,
  readOnlyHint,
  heroCapture = false,
}: {
  jobId: string;
  walkthrough: JobWalkthrough;
  media?: WalkthroughAttachment[];
  canEdit?: boolean;
  canMedia?: boolean;
  allowTranscribe?: boolean;
  allowGenerate?: boolean;
  /** PDF documents module — download walkthrough PDF */
  allowPdf?: boolean;
  readOnlyHint?: string;
  /** Emphasize Record video as the primary Work-phase action */
  heroCapture?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoCaptureRef = useRef<HTMLInputElement>(null);
  const videoLibraryRef = useRef<HTMLInputElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const videoCaptureId = `wt-video-cap-${jobId}`;
  const videoLibraryId = `wt-video-lib-${jobId}`;

  const [notes, setNotes] = useState(walkthrough.notes || '');
  const [report, setReport] = useState(() => reportFromWalkthrough(walkthrough));
  /** When status is saved, show clean view until user chooses Edit */
  const [editingSaved, setEditingSaved] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingVoice, setRecordingVoice] = useState(false);

  useEffect(() => {
    setNotes(walkthrough.notes || '');
    setReport(reportFromWalkthrough(walkthrough));
    if (walkthrough.status === 'saved') setEditingSaved(false);
    if (walkthrough.status === 'generated') setEditingSaved(true);
  }, [
    walkthrough.notes,
    walkthrough.findings,
    walkthrough.work_performed,
    walkthrough.recommendations,
    walkthrough.customer_summary,
    walkthrough.parts,
    walkthrough.labor_hours,
    walkthrough.labor_rate,
    walkthrough.status,
    walkthrough.generated_at,
    walkthrough.saved_at,
  ]);

  const totals = useMemo(
    () =>
      computeWalkthroughTotals({
        parts: report.parts,
        labor_hours: report.labor_hours,
        labor_rate: report.labor_rate,
      }),
    [report.parts, report.labor_hours, report.labor_rate]
  );

  const voices = media.filter((m) => m.kind === 'voice');
  const allPhotos = media.filter((m) => m.kind === 'photo');
  const framePhotos = allPhotos.filter((m) =>
    isWalkthroughFrameCaption(m.caption)
  );
  const photos = allPhotos.filter((m) => !isWalkthroughFrameCaption(m.caption));
  const videos = media.filter((m) => m.kind === 'video');
  const status = walkthrough.status;
  const reportReady = hasReportContent(report);
  const showSavedView =
    status === 'saved' && !editingSaved && reportReady;
  const showEditForm =
    reportReady && (status === 'generated' || editingSaved || status === 'saved');
  const busy = Boolean(pending);
  const hasCapture = notes.trim().length > 0 || media.length > 0;
  const canRunGenerate =
    allowGenerate && canEdit && hasCapture && !recordingVoice && !busy;
  const canDownloadPdf = allowPdf && reportReady;

  function updatePart(
    index: number,
    patch: Partial<WalkthroughPart>
  ) {
    setReport((prev) => ({
      ...prev,
      parts: prev.parts.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  }

  function addPart() {
    setReport((prev) => ({
      ...prev,
      parts: [...prev.parts, { name: '', quantity: 1, estimated_cost: 0 }],
    }));
  }

  function removePart(index: number) {
    setReport((prev) => ({
      ...prev,
      parts: prev.parts.filter((_, i) => i !== index),
    }));
  }

  async function saveDraft() {
    if (!canEdit) return;
    setPending('draft');
    setError(null);
    setMessage(null);
    try {
      const result = await saveWalkthroughDraft(jobId, { notes });
      if (result.error) setError(result.error);
      else {
        setMessage(result.success || 'Draft saved');
        router.refresh();
      }
    } catch {
      setError('Network error — try again');
    }
    setPending(null);
  }

  async function saveToJob(opts?: { wrapUp?: boolean }) {
    if (!canEdit) return;
    const wrapUp = Boolean(opts?.wrapUp);
    setPending(wrapUp ? 'wrap' : 'save');
    setError(null);
    setMessage(null);
    try {
      const result = await saveWalkthroughToJob(jobId, {
        notes,
        findings: report.findings,
        work_performed: report.work_performed,
        recommendations: report.recommendations,
        customer_summary: report.customer_summary,
        parts: report.parts,
        labor_hours: report.labor_hours,
        labor_rate: report.labor_rate,
      });
      if (result.error) setError(result.error);
      else {
        setMessage(
          wrapUp
            ? result.success || 'Applied — opening Wrap up'
            : result.success || 'Saved to job'
        );
        setEditingSaved(false);
        if (wrapUp) {
          setTechJobPhase(pathname, router, 'wrap');
        }
        router.refresh();
      }
    } catch {
      setError('Save failed — try again');
    }
    setPending(null);
  }

  async function uploadFile(
    file: File,
    kind: 'photo' | 'voice' | 'video',
    caption?: string
  ) {
    if (!canMedia) return { error: 'Media not allowed' as string };

    // Videos (and large files) upload straight to Supabase — Vercel server
    // actions reject bodies over ~4.5MB, which breaks phone camera clips.
    const useDirect =
      kind === 'video' || file.size > DIRECT_UPLOAD_THRESHOLD_BYTES;

    try {
      if (useDirect) {
        const begin = await beginWalkthroughMediaUpload({
          jobId,
          kind,
          fileSize: file.size,
          mimeType: file.type,
          fileName: file.name,
        });
        if ('error' in begin && begin.error) {
          return { error: begin.error };
        }
        if (!('storagePath' in begin)) {
          return { error: 'Upload failed — try again' };
        }

        const supabase = createClient();
        const { error: upErr } = await supabase.storage
          .from(begin.bucket)
          .upload(begin.storagePath, file, {
            contentType: begin.contentType,
            upsert: false,
          });
        if (upErr) {
          return {
            error: `Upload failed: ${upErr.message}. Confirm job-media bucket exists and you are signed in.`,
          };
        }

        return completeWalkthroughMediaUpload({
          jobId,
          kind,
          caption,
          storagePath: begin.storagePath,
        });
      }

      const fd = new FormData();
      fd.set('file', file);
      fd.set('kind', kind);
      fd.set('tag', 'walkthrough');
      if (caption) fd.set('caption', caption);
      return await uploadWalkthroughMedia(jobId, fd);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/body|payload|413|too large/i.test(msg)) {
        return {
          error:
            'Video too large for this connection — keep clips under ~90 seconds and try again.',
        };
      }
      return { error: 'Upload failed — try again' };
    }
  }

  async function uploadVideoFramesFromSource(source: Blob | string) {
    const frames = await extractVideoFrames(source, { count: 10 });
    let uploaded = 0;
    for (let i = 0; i < frames.length; i += 1) {
      const result = await uploadFile(
        frames[i],
        'photo',
        frameCaption(i + 1, frames.length)
      );
      if (result.error) {
        if (uploaded === 0) throw new Error(result.error);
        break;
      }
      uploaded += 1;
    }
    return uploaded;
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPending('photo');
    setError(null);
    setMessage(null);
    const result = await uploadFile(file, 'photo');
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Saved');
      router.refresh();
    }
    setPending(null);
  }

  async function onPickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // iOS often returns empty MIME type from the Camera app — accept by
    // extension, or any non-empty file from this video picker.
    const looksLikeVideo =
      !file.type ||
      file.type.startsWith('video/') ||
      /\.(mp4|mov|webm|m4v|qt)$/i.test(file.name);
    if (!looksLikeVideo) {
      setError('Please choose a video file');
      return;
    }
    if (file.size > 80 * 1024 * 1024) {
      setError('Video too large (max 80MB — keep clips under ~90 seconds)');
      return;
    }
    setPending('video');
    setError(null);
    setMessage(
      file.size > 5 * 1024 * 1024
        ? 'Uploading video to storage… this can take a minute on cellular'
        : 'Uploading video…'
    );
    const result = await uploadFile(file, 'video');
    if (result.error) {
      setError(result.error);
      setPending(null);
      return;
    }
    try {
      setMessage('Extracting frames for Grok to see…');
      const n = await uploadVideoFramesFromSource(file);
      setMessage(
        n > 0
          ? `Walkthrough video saved · ${n} frames ready for AI`
          : 'Walkthrough video saved'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} (video saved — try Generate to extract frames)`
          : 'Video saved but frame extract failed — try Generate'
      );
    }
    router.refresh();
    setPending(null);
  }

  async function toggleVoice() {
    if (!canMedia) return;
    setError(null);
    if (recordingVoice && mediaRecorder.current) {
      mediaRecorder.current.stop();
      setRecordingVoice(false);
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
        const file = new File([blob], `walkthrough-${Date.now()}.webm`, {
          type: 'audio/webm',
        });
        setPending('voice');
        setError(null);
        setMessage(null);
        const result = await uploadFile(file, 'voice');
        if (result.error) setError(result.error);
        else {
          setMessage(result.success || 'Saved');
          router.refresh();
        }
        setPending(null);
      };
      mediaRecorder.current = rec;
      rec.start();
      setRecordingVoice(true);
    } catch {
      setError('Microphone permission denied');
    }
  }

  async function removeMedia(attachmentId: string) {
    if (!canMedia) return;
    setPending(`del-${attachmentId}`);
    setError(null);
    const result = await deleteWalkthroughMedia(jobId, attachmentId);
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Removed');
      router.refresh();
    }
    setPending(null);
  }

  async function transcribe(attachmentId: string) {
    setPending(`tx-${attachmentId}`);
    setError(null);
    setMessage(null);
    const result = await transcribeWalkthroughVoice(jobId, attachmentId);
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Transcribed');
      router.refresh();
    }
    setPending(null);
  }

  async function ensureVideoFramesForGenerate() {
    if (videos.length === 0) return;
    if (framePhotos.length >= 4) return;
    const video = videos[0];
    if (!video.url) {
      throw new Error('Walkthrough video has no URL');
    }
    setMessage('Extracting frames so Grok can see the video…');
    const res = await fetch(video.url);
    if (!res.ok) {
      throw new Error('Could not download video to extract frames');
    }
    const blob = await res.blob();
    const n = await uploadVideoFramesFromSource(blob);
    if (n < 1) {
      throw new Error('Could not extract frames from the walkthrough video');
    }
  }

  async function generate() {
    if (!allowGenerate || !canEdit) return;
    setPending('generate');
    setError(null);
    setMessage(null);
    try {
      if (videos.length > 0) {
        await ensureVideoFramesForGenerate();
      }
      setMessage('Grok is watching frames and listening to audio…');
      const res = await fetch('/api/ai/walkthrough', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, notes }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok || data.error) {
        setError(data.error || 'Generate failed — try again');
      } else {
        setMessage(data.message || 'Report generated');
        setEditingSaved(true);
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Generate failed — try again'
      );
    }
    setPending(null);
  }

  return (
    <section className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            Job Walkthrough (AI)
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            {showSavedView
              ? 'Saved on this job — reopen anytime to review or edit'
              : heroCapture
                ? 'Film + narrate — AI writes the report'
                : 'Record → Generate → edit → Save'}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(status)}`}
        >
          {WALKTHROUGH_STATUS_LABELS[status]}
        </span>
      </div>

      {readOnlyHint && !canEdit && !canMedia && (
        <p className="rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 text-sm text-ink-600">
          {readOnlyHint}
        </p>
      )}

      {/* ——— Capture (always available; compact when viewing saved) ——— */}
      {!showSavedView && (
        <div className="space-y-3">
          {canMedia && (
            <input
              id={videoCaptureId}
              ref={videoCaptureRef}
              type="file"
              accept="video/*"
              capture="environment"
              className="sr-only"
              disabled={busy || recordingVoice}
              onChange={onPickVideo}
            />
          )}

          {heroCapture && canMedia ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-4">
              <p className="text-sm font-semibold text-violet-950">
                Main capture
              </p>
              <p className="mt-1 text-sm text-violet-900/80">
                Film + narrate — AI writes the report. Keep clips under ~90
                seconds.
              </p>
              <label
                htmlFor={videoCaptureId}
                className={`mt-3 flex w-full items-center justify-center rounded-xl px-4 py-4 text-center text-base font-semibold text-white ${
                  busy || recordingVoice
                    ? 'pointer-events-none bg-violet-700/50'
                    : 'cursor-pointer bg-violet-700 hover:bg-violet-800'
                }`}
              >
                {pending === 'video'
                  ? 'Saving video…'
                  : 'Record video walkthrough'}
              </label>
            </div>
          ) : null}

          {/*
            Native camera via <label htmlFor> — more reliable on iOS/Android
            than getUserMedia + MediaRecorder.
            With heroCapture: secondary options stay collapsed so mobile
            matches the consolidated desktop layout.
          */}
          {canMedia && heroCapture ? (
            <details className="rounded-xl border border-ink-100 bg-ink-50/40 open:bg-white">
              <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-ink-700 marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-2">
                  <span>More capture options</span>
                  <span className="text-xs font-normal text-ink-400">
                    Voice · photo · library
                  </span>
                </span>
              </summary>
              <div className="space-y-2 border-t border-ink-100 px-3 pb-3 pt-2">
                <p className="text-xs text-ink-400">
                  Stored on this job · tag walkthrough
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleVoice()}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 ${
                      recordingVoice ? 'bg-red-600' : 'bg-ink-800'
                    }`}
                  >
                    {recordingVoice
                      ? 'Stop recording'
                      : pending === 'voice'
                        ? 'Saving…'
                        : 'Record voice'}
                  </button>
                  <button
                    type="button"
                    disabled={busy || recordingVoice}
                    onClick={() => fileRef.current?.click()}
                    className="rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {pending === 'photo' ? 'Uploading…' : 'Add photo'}
                  </button>
                  <label
                    htmlFor={videoLibraryId}
                    className={`rounded-xl border border-ink-200 bg-white px-4 py-3 text-center text-sm font-semibold text-ink-800 sm:col-span-2 ${
                      busy || recordingVoice
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }`}
                  >
                    Choose video from library
                  </label>
                  <input
                    id={videoLibraryId}
                    ref={videoLibraryRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,video/*"
                    className="sr-only"
                    disabled={busy || recordingVoice}
                    onChange={onPickVideo}
                  />
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={onPickPhoto}
                  />
                </div>
              </div>
            </details>
          ) : null}

          {canMedia && !heroCapture ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-ink-700">
                  Walkthrough media
                </p>
                <p className="text-xs text-ink-400">
                  Stored on this job · tag walkthrough
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label
                  htmlFor={videoCaptureId}
                  className={`rounded-xl px-4 py-3 text-center text-sm font-semibold text-white sm:col-span-2 ${
                    busy || recordingVoice
                      ? 'pointer-events-none bg-violet-700/50'
                      : 'cursor-pointer bg-violet-700'
                  }`}
                >
                  {pending === 'video'
                    ? 'Saving video…'
                    : 'Record video walkthrough'}
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void toggleVoice()}
                  className={`rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 ${
                    recordingVoice ? 'bg-red-600' : 'bg-ink-800'
                  }`}
                >
                  {recordingVoice
                    ? 'Stop recording'
                    : pending === 'voice'
                      ? 'Saving…'
                      : 'Record voice'}
                </button>
                <button
                  type="button"
                  disabled={busy || recordingVoice}
                  onClick={() => fileRef.current?.click()}
                  className="rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {pending === 'photo' ? 'Uploading…' : 'Add photo'}
                </button>
                <label
                  htmlFor={videoLibraryId}
                  className={`rounded-xl border border-ink-200 bg-white px-4 py-3 text-center text-sm font-semibold text-ink-800 sm:col-span-2 ${
                    busy || recordingVoice
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer'
                  }`}
                >
                  Choose video from library
                </label>
                <input
                  id={videoLibraryId}
                  ref={videoLibraryRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/*"
                  className="sr-only"
                  disabled={busy || recordingVoice}
                  onChange={onPickVideo}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={onPickPhoto}
                />
              </div>
              <p className="text-xs text-ink-400">
                Record opens your phone camera — narrate while you film (keep
                clips under ~90 seconds). We extract frames (so Grok can see) and
                transcribe audio (so Grok can hear) when you Generate.
              </p>
            </>
          ) : null}

          {videos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Videos ({videos.length})
              </p>
              <ul className="space-y-2">
                {videos.map((a, idx) => (
                  <li
                    key={a.id}
                    className="rounded-xl border border-ink-100 bg-white p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink-800">
                        Video {videos.length - idx}
                      </p>
                      <p className="text-xs text-ink-400">
                        {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                    {a.url ? (
                      <video
                        controls
                        playsInline
                        src={a.url}
                        className="w-full rounded-lg bg-ink-950"
                      />
                    ) : (
                      <p className="text-sm text-ink-400">No video URL</p>
                    )}
                    {a.caption && (
                      <p className="mt-2 whitespace-pre-wrap text-xs text-ink-600">
                        {a.caption}
                      </p>
                    )}
                    {framePhotos.length > 0 && idx === 0 && (
                      <p className="mt-2 text-xs text-ink-500">
                        {framePhotos.length} AI frames ready for Grok vision
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3">
                      {allowTranscribe && canEdit && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void transcribe(a.id)}
                          className="text-xs font-semibold text-brand-700 hover:underline disabled:opacity-50"
                        >
                          {pending === `tx-${a.id}`
                            ? 'Transcribing…'
                            : 'Transcribe audio → notes'}
                        </button>
                      )}
                      {canMedia && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void removeMedia(a.id)}
                          className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                        >
                          {pending === `del-${a.id}` ? 'Removing…' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {voices.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Voice notes ({voices.length})
              </p>
              <ul className="space-y-2">
                {voices.map((a, idx) => (
                  <li
                    key={a.id}
                    className="rounded-xl border border-ink-100 bg-white p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink-800">
                        Voice {voices.length - idx}
                      </p>
                      <p className="text-xs text-ink-400">
                        {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                    {a.url ? (
                      <audio controls src={a.url} className="w-full" />
                    ) : (
                      <p className="text-sm text-ink-400">No audio URL</p>
                    )}
                    {a.caption && (
                      <p className="mt-2 whitespace-pre-wrap text-xs text-ink-600">
                        {a.caption}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3">
                      {allowTranscribe && canEdit && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void transcribe(a.id)}
                          className="text-xs font-semibold text-brand-700 hover:underline disabled:opacity-50"
                        >
                          {pending === `tx-${a.id}`
                            ? 'Transcribing…'
                            : 'Transcribe → notes'}
                        </button>
                      )}
                      {canMedia && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void removeMedia(a.id)}
                          className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                        >
                          {pending === `del-${a.id}` ? 'Removing…' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {photos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Photos ({photos.length})
              </p>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {photos.map((a) => (
                  <li
                    key={a.id}
                    className="overflow-hidden rounded-xl border border-ink-100 bg-white"
                  >
                    {a.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a href={a.url} target="_blank" rel="noreferrer">
                        <img
                          src={a.url}
                          alt=""
                          className="aspect-square w-full object-cover"
                        />
                      </a>
                    ) : (
                      <div className="aspect-square bg-ink-100" />
                    )}
                    <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                      <p className="truncate text-[10px] text-ink-400">
                        {new Date(a.created_at).toLocaleDateString()}
                      </p>
                      {canMedia && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void removeMedia(a.id)}
                          className="shrink-0 text-[11px] font-medium text-red-700 hover:underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {media.length === 0 && (
            <p className="rounded-xl border border-dashed border-ink-200 bg-ink-50/50 px-3 py-4 text-center text-sm text-ink-400">
              No walkthrough media yet — record a video (best), voice, or photo
            </p>
          )}

          <label className="block">
            <FieldLabel>Field notes</FieldLabel>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={!canEdit || busy}
              placeholder="What you saw, heard, measured…"
              className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 disabled:bg-ink-50"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <button
                type="button"
                disabled={busy || recordingVoice}
                onClick={saveDraft}
                className="rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 disabled:opacity-50"
              >
                {pending === 'draft' ? 'Saving…' : 'Save draft'}
              </button>
            )}
            <button
              type="button"
              disabled={!canRunGenerate}
              title={
                !allowGenerate
                  ? 'Turn on AI tools + AI Job Walkthrough'
                  : !hasCapture
                    ? 'Add notes, voice, or a photo first'
                    : 'Generate report with Grok'
              }
              onClick={() => void generate()}
              className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white disabled:border disabled:border-violet-200 disabled:bg-violet-50 disabled:text-violet-400"
            >
              {pending === 'generate'
                ? 'Generating…'
                : reportReady
                  ? 'Regenerate Report'
                  : 'Generate Report'}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {error}
        </p>
      )}

      {/* ——— Saved view ——— */}
      {showSavedView && (
        <div className="space-y-4 border-t border-ink-100 pt-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-900">
              Saved to this job
            </p>
            {walkthrough.saved_at && (
              <p className="mt-0.5 text-xs text-emerald-800/80">
                {new Date(walkthrough.saved_at).toLocaleString()}
                {walkthrough.generated_at
                  ? ` · AI generated ${new Date(walkthrough.generated_at).toLocaleString()}`
                  : ''}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SavedBlock label="Findings" value={walkthrough.findings} />
            <SavedBlock
              label="Work performed"
              value={walkthrough.work_performed}
            />
            <SavedBlock
              label="Recommendations"
              value={walkthrough.recommendations}
            />
            <SavedBlock
              label="Customer summary"
              value={walkthrough.customer_summary}
            />
          </div>

          {(walkthrough.parts.length > 0 ||
            walkthrough.labor_hours != null) && (
            <div className="rounded-xl border border-ink-100 bg-ink-50/60 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                Parts & labor
              </p>
              {walkthrough.parts.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-ink-800">
                  {walkthrough.parts.map((p, i) => (
                    <li key={`${p.name}-${i}`}>
                      {p.name} × {p.quantity}
                      {p.estimated_cost
                        ? ` · ${money(p.estimated_cost)}`
                        : ''}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <p className="text-xs text-ink-500">Parts</p>
                  <p className="font-semibold text-ink-900">
                    {money(walkthrough.parts_total ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-500">Labor</p>
                  <p className="font-semibold text-ink-900">
                    {money(
                      (walkthrough.labor_hours || 0) *
                        (walkthrough.labor_rate || 0)
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-500">Total</p>
                  <p className="font-semibold text-ink-900">
                    {money(walkthrough.total_estimated ?? 0)}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-ink-500">
                Labor:{' '}
                {walkthrough.labor_hours != null
                  ? `${walkthrough.labor_hours}h`
                  : '—'}
                {walkthrough.labor_rate != null
                  ? ` @ ${money(walkthrough.labor_rate)}/h`
                  : ''}
              </p>
            </div>
          )}

            {media.length > 0 && (
            <p className="text-xs text-ink-500">
              {videos.length} video · {voices.length} voice · {photos.length}{' '}
              photo{photos.length !== 1 ? 's' : ''}
              {framePhotos.length > 0
                ? ` · ${framePhotos.length} AI frames`
                : ''}{' '}
              on this walkthrough
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTechJobPhase(pathname, router, 'wrap')}
              className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 sm:w-auto"
            >
              Continue to Wrap up
            </button>
            {canEdit && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditingSaved(true);
                  setMessage(null);
                  setError(null);
                }}
                className="rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 hover:bg-ink-50 disabled:opacity-50"
              >
                Edit walkthrough
              </button>
            )}
            {canDownloadPdf && (
              <a
                href={`/api/jobs/${jobId}/walkthrough/pdf`}
                className="rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-800 hover:bg-ink-50"
              >
                Download PDF
              </a>
            )}
            {canRunGenerate && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditingSaved(true);
                  void generate();
                }}
                className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-800 disabled:opacity-50"
              >
                Regenerate with AI
              </button>
            )}
            {!canRunGenerate && allowGenerate && canEdit && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditingSaved(true);
                  setMessage(null);
                }}
                className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-800 disabled:opacity-50"
              >
                Capture more & regenerate
              </button>
            )}
          </div>
          {!allowPdf && (
            <p className="text-xs text-ink-400">
              PDF download needs Feature modules → PDF documents
            </p>
          )}
        </div>
      )}

      {/* ——— Editable report ——— */}
      {showEditForm && !showSavedView && (
        <div className="space-y-4 border-t border-ink-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink-700">
              {status === 'generated'
                ? 'Review & edit report'
                : 'Edit walkthrough'}
            </p>
            {status === 'saved' && (
              <button
                type="button"
                className="text-xs font-semibold text-ink-500 hover:text-ink-800"
                onClick={() => setEditingSaved(false)}
              >
                Cancel — view saved
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-1">
              <FieldLabel>Findings</FieldLabel>
              <textarea
                value={report.findings}
                onChange={(e) =>
                  setReport((r) => ({ ...r, findings: e.target.value }))
                }
                rows={4}
                disabled={!canEdit || busy}
                className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm disabled:bg-ink-50"
              />
            </label>
            <label className="block">
              <FieldLabel>Work performed</FieldLabel>
              <textarea
                value={report.work_performed}
                onChange={(e) =>
                  setReport((r) => ({ ...r, work_performed: e.target.value }))
                }
                rows={4}
                disabled={!canEdit || busy}
                className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm disabled:bg-ink-50"
              />
            </label>
            <label className="block">
              <FieldLabel>Recommendations</FieldLabel>
              <textarea
                value={report.recommendations}
                onChange={(e) =>
                  setReport((r) => ({ ...r, recommendations: e.target.value }))
                }
                rows={3}
                disabled={!canEdit || busy}
                className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm disabled:bg-ink-50"
              />
            </label>
            <label className="block">
              <FieldLabel>Customer summary</FieldLabel>
              <textarea
                value={report.customer_summary}
                onChange={(e) =>
                  setReport((r) => ({
                    ...r,
                    customer_summary: e.target.value,
                  }))
                }
                rows={3}
                disabled={!canEdit || busy}
                className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm disabled:bg-ink-50"
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldLabel>Parts used</FieldLabel>
              {canEdit && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={addPart}
                  className="text-xs font-semibold text-brand-700 hover:underline disabled:opacity-50"
                >
                  + Add part
                </button>
              )}
            </div>
            {report.parts.length === 0 ? (
              <p className="text-sm italic text-ink-400">
                No parts — add a line or regenerate
              </p>
            ) : (
              <ul className="space-y-2">
                {report.parts.map((p, i) => (
                  <li
                    key={i}
                    className="grid gap-2 rounded-xl border border-ink-100 bg-white p-2 sm:grid-cols-[1fr_4.5rem_6rem_auto]"
                  >
                    <input
                      value={p.name}
                      onChange={(e) => updatePart(i, { name: e.target.value })}
                      placeholder="Part name"
                      disabled={!canEdit || busy}
                      className="rounded-lg border border-ink-200 px-2 py-1.5 text-sm disabled:bg-ink-50"
                    />
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={p.quantity}
                      onChange={(e) =>
                        updatePart(i, {
                          quantity: Number(e.target.value) || 0,
                        })
                      }
                      disabled={!canEdit || busy}
                      title="Qty"
                      className="rounded-lg border border-ink-200 px-2 py-1.5 text-sm disabled:bg-ink-50"
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={p.estimated_cost}
                      onChange={(e) =>
                        updatePart(i, {
                          estimated_cost: Number(e.target.value) || 0,
                        })
                      }
                      disabled={!canEdit || busy}
                      title="Est. cost"
                      className="rounded-lg border border-ink-200 px-2 py-1.5 text-sm disabled:bg-ink-50"
                    />
                    {canEdit && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removePart(i)}
                        className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <FieldLabel>Labor hours</FieldLabel>
              <input
                type="number"
                min={0}
                step={0.25}
                value={report.labor_hours ?? ''}
                onChange={(e) =>
                  setReport((r) => ({
                    ...r,
                    labor_hours:
                      e.target.value === ''
                        ? null
                        : Number(e.target.value) || 0,
                  }))
                }
                disabled={!canEdit || busy}
                className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm disabled:bg-ink-50"
              />
            </label>
            <label className="block">
              <FieldLabel>Labor rate ($/hr)</FieldLabel>
              <input
                type="number"
                min={0}
                step={1}
                value={report.labor_rate ?? ''}
                onChange={(e) =>
                  setReport((r) => ({
                    ...r,
                    labor_rate:
                      e.target.value === ''
                        ? null
                        : Number(e.target.value) || 0,
                  }))
                }
                disabled={!canEdit || busy}
                className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm disabled:bg-ink-50"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-xl border border-ink-200 bg-ink-50 px-3 py-3 text-center">
            <div>
              <p className="text-xs text-ink-500">Parts total</p>
              <p className="text-sm font-semibold text-ink-950">
                {money(totals.parts_total)}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Labor total</p>
              <p className="text-sm font-semibold text-ink-950">
                {money(totals.labor_total)}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Grand total</p>
              <p className="text-sm font-semibold text-ink-950">
                {money(totals.total_estimated)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <>
                <button
                  type="button"
                  disabled={busy || recordingVoice}
                  onClick={() => void saveToJob({ wrapUp: true })}
                  className="w-full rounded-xl bg-emerald-700 px-4 py-3.5 text-base font-semibold text-white disabled:opacity-50 sm:w-auto"
                >
                  {pending === 'wrap'
                    ? 'Applying…'
                    : 'Apply & wrap up'}
                </button>
                <button
                  type="button"
                  disabled={busy || recordingVoice}
                  onClick={() => void saveToJob()}
                  className="rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-semibold text-ink-800 hover:bg-ink-50 disabled:opacity-50"
                >
                  {pending === 'save' ? 'Saving…' : 'Save only'}
                </button>
              </>
            )}
            {canDownloadPdf && (
              <a
                href={`/api/jobs/${jobId}/walkthrough/pdf`}
                className="rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-semibold text-ink-800 hover:bg-ink-50"
              >
                Download PDF
              </a>
            )}
          </div>
          <p className="text-xs text-ink-400">
            Apply & wrap up saves findings → diagnosis, customer summary, and
            line items, then opens Wrap up (Clock out / Sign). Save only stays
            on Work.
          </p>
        </div>
      )}

      {/* Empty report shell before first generate */}
      {!reportReady && !showSavedView && (
        <div className="space-y-2 border-t border-ink-100 pt-4">
          <p className="text-sm font-medium text-ink-700">
            Report
            <span className="ml-2 font-normal text-ink-400">
              — empty until Generate
            </span>
          </p>
          <p className="text-sm text-ink-400">
            After Generate you can edit every field, then Apply & wrap up.
          </p>
        </div>
      )}
    </section>
  );
}
