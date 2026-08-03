/** Prefer browser→Supabase above this — Vercel server actions hard-cap ~4.5MB. */
export const DIRECT_UPLOAD_THRESHOLD_BYTES = 3 * 1024 * 1024;

export const VIDEO_MAX_BYTES = 80 * 1024 * 1024;
export const OTHER_MEDIA_MAX_BYTES = 20 * 1024 * 1024;
