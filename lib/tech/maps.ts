import { formatAddress } from '@/lib/utils';

export function mapsDirectionsUrl(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}) {
  const q = formatAddress(parts);
  if (!q) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    q.replace(/ · /g, ', ')
  )}`;
}

export function mapsSearchUrl(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}) {
  const q = formatAddress(parts);
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    q.replace(/ · /g, ', ')
  )}`;
}
