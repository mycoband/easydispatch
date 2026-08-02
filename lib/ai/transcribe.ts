/**
 * Transcribe field audio/video via OpenAI Whisper when OPENAI_API_KEY is set.
 *
 * Whisper accepts: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm
 * (not .mov — common from iPhone camera; we send those as .mp4 for demux).
 */

const WHISPER_EXTS = new Set([
  'flac',
  'm4a',
  'mp3',
  'mp4',
  'mpeg',
  'mpga',
  'oga',
  'ogg',
  'wav',
  'webm',
]);

const MAX_WHISPER_BYTES = 25 * 1024 * 1024;

function basenameFromUrlOrName(name: string): string {
  const cleaned = name.split('?')[0].split('#')[0].trim();
  const base = cleaned.split('/').pop() || cleaned;
  return base || 'media.bin';
}

function extOf(name: string): string {
  const base = basenameFromUrlOrName(name);
  const dot = base.lastIndexOf('.');
  if (dot < 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

/**
 * Pick a Whisper-safe filename + MIME from storage URL / Content-Type / kind.
 * iPhone walkthroughs are often video/quicktime (.mov) — Whisper rejects .mov,
 * but the same bytes usually demux when uploaded as .mp4.
 */
export function whisperUploadMeta(input: {
  filename?: string | null;
  mimeType?: string | null;
  kind?: 'voice' | 'video' | string | null;
}): { filename: string; mimeType: string } {
  const rawName = basenameFromUrlOrName(input.filename || '');
  let ext = extOf(rawName);
  const mime = (input.mimeType || '').toLowerCase().split(';')[0].trim();

  if (!ext || !WHISPER_EXTS.has(ext)) {
    if (ext === 'mov' || mime.includes('quicktime')) {
      ext = 'mp4';
    } else if (mime.includes('webm')) {
      ext = 'webm';
    } else if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) {
      ext = mime.includes('m4a') || mime.includes('aac') ? 'm4a' : 'mp4';
    } else if (mime.includes('mpeg') || mime.includes('mp3')) {
      ext = mime.includes('mp3') ? 'mp3' : 'mpeg';
    } else if (mime.includes('wav')) {
      ext = 'wav';
    } else if (mime.includes('ogg') || mime.includes('oga')) {
      ext = 'ogg';
    } else if (mime.includes('flac')) {
      ext = 'flac';
    } else if (input.kind === 'video') {
      ext = 'mp4';
    } else {
      ext = 'webm';
    }
  }

  // Final safety: never send .mov to Whisper
  if (ext === 'mov') ext = 'mp4';
  if (!WHISPER_EXTS.has(ext)) ext = input.kind === 'video' ? 'mp4' : 'webm';

  const mimeOut =
    ext === 'mp4'
      ? 'video/mp4'
      : ext === 'webm'
        ? input.kind === 'video'
          ? 'video/webm'
          : 'audio/webm'
        : ext === 'm4a'
          ? 'audio/m4a'
          : ext === 'mp3'
            ? 'audio/mpeg'
            : ext === 'wav'
              ? 'audio/wav'
              : ext === 'ogg' || ext === 'oga'
                ? 'audio/ogg'
                : ext === 'flac'
                  ? 'audio/flac'
                  : `audio/${ext}`;

  return {
    filename: `walkthrough.${ext}`,
    mimeType: mimeOut,
  };
}

export async function transcribeAudioBuffer(
  buffer: Buffer,
  filename: string,
  mimeType?: string | null,
  kind?: 'voice' | 'video' | string | null
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not set. Add it to enable voice → notes (Whisper).'
    );
  }

  if (!buffer?.length) {
    throw new Error('Media file is empty');
  }
  if (buffer.length > MAX_WHISPER_BYTES) {
    throw new Error(
      'Recording too large for transcription (max 25MB). Use a shorter clip (~90s).'
    );
  }

  const meta = whisperUploadMeta({ filename, mimeType, kind });
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: meta.mimeType,
  });
  form.append('file', blob, meta.filename);
  form.append('model', 'whisper-1');
  form.append('language', 'en');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    // Friendlier hint for stubborn iPhone containers
    if (/invalid.?file.?format|unsupported/i.test(err)) {
      throw new Error(
        `Transcription failed: unsupported media format. Re-record as a short MP4/WebM clip (narrate clearly). Details: ${err.slice(0, 240)}`
      );
    }
    throw new Error(`Transcription failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { text?: string };
  const text = (data.text || '').trim();
  if (!text) {
    throw new Error('No speech detected in the recording');
  }
  return text;
}
