import { type NextRequest } from 'next/server';
import {
  redirectWithSession,
  updateSession,
} from '@/lib/supabase/middleware';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/join',
  '/faq',
  '/features',
  '/pricing',
  '/privacy',
  '/terms',
  '/robots.txt',
  '/sitemap.xml',
  '/opengraph-image',
  '/auth',
  '/pay',
  '/portal',
  '/confirm',
  '/billing-locked',
  '/api/stripe/webhook',
  '/api/webhooks',
  '/api/inngest',
  // Vercel Cron has no session — routes enforce CRON_SECRET (fail-closed).
  '/api/cron',
];

export async function middleware(request: NextRequest) {
  const { user, supabase, supabaseResponse } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return redirectWithSession(url, supabaseResponse);
  }

  // Logged-in users hitting login or `/` → send to app (PWA start_url is `/`).
  // Marketing inner pages (/features, /pricing, /faq) stay viewable while signed in.
  // /join stays reachable so we can show "already signed in → add team in Settings"
  if (user && (pathname === '/login' || pathname === '/')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const url = request.nextUrl.clone();
    url.pathname = profile?.role === 'technician' ? '/tech' : '/dashboard';
    url.search = '';
    return redirectWithSession(url, supabaseResponse);
  }

  // App HTML: always revalidate (avoid stale iOS Safari shells after deploys).
  // PWA static assets (/icons, /sw.js, manifest) are excluded from this matcher.
  supabaseResponse.headers.set(
    'Cache-Control',
    'private, no-cache, no-store, must-revalidate'
  );
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Run auth on app routes. Skip Next static, images, and PWA shell assets
     * so the service worker can cache them with long-lived headers.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|apple-touch-icon\\.png|manifest\\.webmanifest|sw\\.js|offline\\.html|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
