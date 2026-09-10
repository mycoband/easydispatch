import type { MetadataRoute } from 'next';
import { MARKETING_ORIGIN } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/features', '/pricing', '/faq', '/privacy', '/terms', '/login'],
        disallow: [
          '/dashboard',
          '/tech',
          '/api',
          '/portal',
          '/pay',
          '/confirm',
          '/billing-locked',
          '/join',
        ],
      },
    ],
    sitemap: `${MARKETING_ORIGIN}/sitemap.xml`,
    host: MARKETING_ORIGIN,
  };
}
