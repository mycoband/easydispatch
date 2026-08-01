export type LatLng = { lat: number; lng: number };

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/** Great-circle distance in miles. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Closer = higher score (0–1). Beyond `capMiles` → ~0.
 * Missing either point → 0.5 (neutral).
 */
export function proximityScore(
  tech: LatLng | null | undefined,
  job: LatLng | null | undefined,
  capMiles = 40
): number {
  if (!tech || !job) return 0.5;
  if (!isValidLatLng(tech.lat, tech.lng) || !isValidLatLng(job.lat, job.lng)) {
    return 0.5;
  }
  const miles = haversineMiles(tech, job);
  return Math.max(0, 1 - miles / capMiles);
}

export function formatMiles(miles: number | null | undefined): string | null {
  if (miles == null || !Number.isFinite(miles)) return null;
  if (miles < 1) return `${Math.round(miles * 10) / 10} mi`;
  return `${Math.round(miles)} mi`;
}
