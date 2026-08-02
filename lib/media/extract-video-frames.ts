/**
 * Browser-only: sample JPEG frames from a walkthrough video for Grok vision.
 * xAI chat models accept images (not native video_url), so we extract stills.
 */

export const WALKTHROUGH_FRAME_CAPTION_PREFIX = 'Walkthrough frame';

export function isWalkthroughFrameCaption(caption: string | null | undefined) {
  return Boolean(caption?.startsWith(WALKTHROUGH_FRAME_CAPTION_PREFIX));
}

export type ExtractVideoFramesOptions = {
  /** Evenly spaced samples (default 10). */
  count?: number;
  /** Max width/height before JPEG encode (default 1280). */
  maxEdge?: number;
  /** JPEG quality 0–1 (default 0.72). */
  quality?: number;
};

function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';

    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onerror = null;
    };

    video.onloadedmetadata = () => {
      cleanup();
      resolve(video);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('Could not load video for frame extraction'));
    };

    video.src = src;
  });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      reject(new Error('Video seek failed'));
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    try {
      video.currentTime = Math.min(
        Math.max(0, time),
        Math.max(0, (video.duration || 0) - 0.05)
      );
    } catch (err) {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      reject(err);
    }
  });
}

function canvasToJpeg(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Frame encode failed'));
        else resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Extract evenly spaced JPEG frames from a video Blob or object URL.
 */
export async function extractVideoFrames(
  source: Blob | string,
  options: ExtractVideoFramesOptions = {}
): Promise<File[]> {
  const count = Math.min(16, Math.max(4, options.count ?? 10));
  const maxEdge = options.maxEdge ?? 1280;
  const quality = options.quality ?? 0.72;

  const objectUrl =
    typeof source === 'string' ? source : URL.createObjectURL(source);
  const shouldRevoke = typeof source !== 'string';

  try {
    const video = await loadVideo(objectUrl);
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration <= 0.05 && video.videoWidth <= 0) {
      throw new Error('Video has no readable frames');
    }

    const times: number[] = [];
    if (duration <= 0.2) {
      times.push(0);
    } else {
      for (let i = 0; i < count; i += 1) {
        // Stay off exact start/end (some codecs flash black)
        const t = duration * ((i + 0.5) / count);
        times.push(t);
      }
    }

    const files: File[] = [];
    for (let i = 0; i < times.length; i += 1) {
      await seekVideo(video, times[i]);
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      const scale = Math.min(1, maxEdge / Math.max(vw, vh));
      const w = Math.max(1, Math.round(vw * scale));
      const h = Math.max(1, Math.round(vh * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not available');
      ctx.drawImage(video, 0, 0, w, h);
      const blob = await canvasToJpeg(canvas, quality);
      files.push(
        new File(
          [blob],
          `walkthrough-frame-${i + 1}-of-${times.length}.jpg`,
          { type: 'image/jpeg' }
        )
      );
    }

    video.removeAttribute('src');
    video.load();
    return files;
  } finally {
    if (shouldRevoke) URL.revokeObjectURL(objectUrl);
  }
}

export function frameCaption(index: number, total: number) {
  return `${WALKTHROUGH_FRAME_CAPTION_PREFIX} ${index}/${total}`;
}
