/**
 * Convert walkthrough video/voice to mono MP3 for OpenAI Whisper.
 * iPhone .mov / quicktime often fails Whisper even when renamed to .mp4.
 */

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function sniffContainerExt(buf: Buffer): string {
  if (buf.length >= 12) {
    const box = buf.toString('ascii', 4, 8);
    if (box === 'ftyp') {
      const brand = buf.toString('ascii', 8, 12).replace(/\0/g, '');
      if (brand.startsWith('qt')) return 'mov';
      return 'mp4';
    }
  }
  if (
    buf.length >= 4 &&
    buf[0] === 0x1a &&
    buf[1] === 0x45 &&
    buf[2] === 0xdf
  ) {
    return 'webm';
  }
  if (buf.length >= 4 && buf.toString('ascii', 0, 4) === 'RIFF') return 'wav';
  if (buf.length >= 4 && buf.toString('ascii', 0, 4) === 'OggS') return 'ogg';
  if (buf.length >= 3 && buf.toString('ascii', 0, 3) === 'ID3') return 'mp3';
  return 'mp4';
}

function resolveFfmpegPath(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('ffmpeg-static') as string | null;
  if (!path) {
    throw new Error('ffmpeg-static binary not found');
  }
  return path;
}

export async function convertMediaToMp3ForWhisper(
  input: Buffer
): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  if (!input?.length) {
    throw new Error('Media file is empty');
  }

  const ffmpegPath = resolveFfmpegPath();
  const id = randomBytes(8).toString('hex');
  const ext = sniffContainerExt(input);
  const inPath = join(tmpdir(), `ed-in-${id}.${ext}`);
  const outPath = join(tmpdir(), `ed-out-${id}.mp3`);

  await fs.writeFile(inPath, input);
  try {
    await new Promise<void>((resolve, reject) => {
      const args = [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        inPath,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-b:a',
        '64k',
        '-f',
        'mp3',
        outPath,
      ];
      const proc = spawn(ffmpegPath, args, {
        stdio: ['ignore', 'ignore', 'pipe'],
        windowsHide: true,
      });
      let stderr = '';
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
        if (stderr.length > 4000) stderr = stderr.slice(-4000);
      });
      proc.on('error', (err) => reject(err));
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else {
          reject(
            new Error(
              `Could not extract audio from recording${
                stderr.trim() ? `: ${stderr.trim().slice(0, 240)}` : ''
              }`
            )
          );
        }
      });
    });

    const buffer = await fs.readFile(outPath);
    if (!buffer.length) {
      throw new Error('Audio extract produced an empty file');
    }
    return {
      buffer,
      filename: 'walkthrough.mp3',
      mimeType: 'audio/mpeg',
    };
  } finally {
    await Promise.all([
      fs.unlink(inPath).catch(() => undefined),
      fs.unlink(outPath).catch(() => undefined),
    ]);
  }
}
