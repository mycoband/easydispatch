import type { MetadataRoute } from 'next';
import { MARKETING_ORIGIN } from '@/lib/site';

const pages = [
  '',
  '/features',
  '/pricing',
  '/faq',
  '/privacy',
  '/terms',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((path) => ({
    url: `${MARKETING_ORIGIN}${path}`,
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.7,
  }));
}
