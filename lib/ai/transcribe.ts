/**
 * Transcribe field audio via OpenAI Whisper when OPENAI_API_KEY is set.
 */

export async function transcribeAudioBuffer(
  buffer: Buffer,
  filename: string,
  mimeType?: string | null
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not set. Add it to enable voice → notes (Whisper).'
    );
  }

  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: mimeType || 'audio/webm',
  });
  form.append('file', blob, filename || 'voice.webm');
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
    throw new Error(`Transcription failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { text?: string };
  const text = (data.text || '').trim();
  if (!text) {
    throw new Error('No speech detected in the recording');
  }
  return text;
}
