/**
 * Sample JPEG stills from a walkthrough video (server-side).
 * Used so Generate works on iOS where in-browser frame extract often hangs.
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

function runFfmpeg(args: string[]): Promise<void> {
  const ffmpegPath = resolveFfmpegPath();
  return new Promise((resolve, reject) => {
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
            `ffmpeg frame extract failed${
              stderr.trim() ? `: ${stderr.trim().slice(0, 240)}` : ''
            }`
          )
        );
      }
    });
  });
}

/**
 * Extract up to `count` JPEG frames spaced across the video.
 */
export async function extractJpegFramesFromVideo(
  input: Buffer,
  options?: { count?: number }
): Promise<Buffer[]> {
  if (!input?.length) {
    throw new Error('Video file is empty');
  }

  const count = Math.min(12, Math.max(4, options?.count ?? 8));
  const id = randomBytes(8).toString('hex');
  const ext = sniffContainerExt(input);
  const dir = join(tmpdir(), `ed-frames-${id}`);
  const inPath = join(dir, `input.${ext}`);
  const pattern = join(dir, 'frame-%03d.jpg');

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(inPath, input);

  try {
    // ~1 frame every 3s, capped at `count` — works without ffprobe
    await runFfmpeg([
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      inPath,
      '-vf',
      'fps=1/3,scale=1280:-2:flags=lanczos',
      '-frames:v',
      String(count),
      '-q:v',
      '5',
      pattern,
    ]);

    const names = (await fs.readdir(dir))
      .filter((n) => /^frame-\d+\.jpg$/i.test(n))
      .sort();
    const frames: Buffer[] = [];
    for (const name of names) {
      const buf = await fs.readFile(join(dir, name));
      if (buf.length > 0) frames.push(buf);
    }
    if (frames.length === 0) {
      throw new Error('No frames could be extracted from the video');
    }
    return frames;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
