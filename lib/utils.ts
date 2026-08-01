import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(parts: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}) {
  const line1 = parts.address?.trim();
  const line2 = [parts.city, parts.state].filter(Boolean).join(', ');
  const withZip = [line2, parts.zip].filter(Boolean).join(' ');
  return [line1, withZip].filter(Boolean).join(' · ');
}
