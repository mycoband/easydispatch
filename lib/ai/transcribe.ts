/**
 * Transcribe field audio/video via OpenAI Whisper when OPENAI_API_KEY is set.
 *
 * Phone videos (especially iPhone .mov) are converted to mono MP3 with ffmpeg
 * before upload — Whisper rejects many raw camera containers.
 */

import { convertMediaToMp3ForWhisper } from '@/lib/ai/ffmpeg-audio';

const MAX_WHISPER_BYTES = 25 * 1024 * 1024;

function basenameFromUrlOrName(name: string): string {
  const cleaned = name.split('?')[0].split('#')[0].trim();
  return cleaned.split('/').pop() || cleaned || 'media.bin';
}

function looksLikeVideo(input: {
  filename?: string | null;
  mimeType?: string | null;
  kind?: string | null;
}): boolean {
  if (input.kind === 'video') return true;
  const mime = (input.mimeType || '').toLowerCase();
  if (mime.startsWith('video/')) return true;
  const name = basenameFromUrlOrName(input.filename || '').toLowerCase();
  return /\.(mov|mp4|m4v|webm|avi|mkv)$/i.test(name);
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

  let uploadBuffer = buffer;
  let uploadName = 'audio.webm';
  let uploadMime = 'audio/webm';

  // Extract/remux to MP3 — phone camera containers often fail Whisper raw
  try {
    const converted = await convertMediaToMp3ForWhisper(buffer);
    uploadBuffer = converted.buffer;
    uploadName = converted.filename;
    uploadMime = converted.mimeType;
  } catch (err) {
    if (looksLikeVideo({ filename, mimeType, kind })) {
      throw err instanceof Error
        ? err
        : new Error('Could not extract audio from video');
    }
    const base = basenameFromUrlOrName(filename);
    uploadName = /\.(webm|wav|mp3|m4a|ogg)$/i.test(base) ? base : 'voice.webm';
    uploadMime = mimeType || 'audio/webm';
    console.warn('ffmpeg convert skipped; sending original media', err);
  }

  if (uploadBuffer.length > MAX_WHISPER_BYTES) {
    throw new Error(
      'Recording too large for transcription (max 25MB). Use a shorter clip (~90s).'
    );
  }

  const form = new FormData();
  const file = new File([new Uint8Array(uploadBuffer)], uploadName, {
    type: uploadMime,
  });
  form.append('file', file);
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
    if (/invalid.?file.?format|unsupported/i.test(err)) {
      throw new Error(
        'Transcription failed: could not read this recording. Re-record a short walkthrough (under ~90s) with clear narration, then try again.'
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
