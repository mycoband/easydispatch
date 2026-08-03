import { type NextRequest } from 'next/server';
import {
  redirectWithSession,
  updateSession,
} from '@/lib/supabase/middleware';

const PUBLIC_PATHS = [
  '/login',
  '/join',
  '/auth',
  '/pay',
  '/portal',
  '/confirm',
  '/billing-locked',
  '/api/stripe/webhook',
];

export async function middleware(request: NextRequest) {
  const { user, supabase, supabaseResponse } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!user && !isPublic && pathname !== '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return redirectWithSession(url, supabaseResponse);
  }

  // Logged-in users hitting login/home → send to app (with session cookies intact)
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

  // Avoid stale HTML on iOS Safari (was showing old walkthrough UI after deploys)
  supabaseResponse.headers.set(
    'Cache-Control',
    'private, no-cache, no-store, must-revalidate'
  );
  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
