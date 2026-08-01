'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { homeForRole, type AppRole } from '@/lib/roles';

type Mode = 'signin' | 'signup';
type SignupPath = 'new_company' | 'join_team';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const errorParam = searchParams.get('error');
  const inviteFromUrl = (searchParams.get('invite') || '').trim().toUpperCase();
  const wantJoin =
    searchParams.get('join') === '1' ||
    searchParams.get('mode') === 'signup' ||
    Boolean(inviteFromUrl);

  const [mode, setMode] = useState<Mode>(wantJoin ? 'signup' : 'signin');
  const [signupPath, setSignupPath] = useState<SignupPath>(
    inviteFromUrl || searchParams.get('join') === '1'
      ? 'join_team'
      : 'new_company'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [inviteCode, setInviteCode] = useState(inviteFromUrl);
  const [role, setRole] = useState<AppRole>('technician');
  const [error, setError] = useState<string | null>(
    errorParam === 'profile'
      ? 'Profile missing. Sign up again or contact your admin.'
      : null
  );
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  function formatAuthError(err: unknown): string {
    if (err instanceof Error && err.message.trim() && err.message.trim() !== '{}') {
      return err.message;
    }
    if (err && typeof err === 'object') {
      const o = err as {
        message?: unknown;
        error_description?: unknown;
        msg?: unknown;
        code?: unknown;
        status?: unknown;
      };
      for (const key of ['message', 'error_description', 'msg'] as const) {
        const v = o[key];
        if (typeof v === 'string' && v.trim() && v.trim() !== '{}') {
          return v;
        }
      }
      if (typeof o.code === 'string' && o.code) {
        return `Sign up failed (${o.code}). Try a different email or password.`;
      }
    }
    return 'Sign up failed. Try a different email, a longer password, or try again in a minute.';
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const supabase = createClient();

    try {
      if (mode === 'signup') {
        if (signupPath === 'new_company' && !companyName.trim()) {
          throw new Error('Company name is required');
        }
        if (signupPath === 'join_team' && !inviteCode.trim()) {
          throw new Error('Invite code is required');
        }

        const meta =
          signupPath === 'new_company'
            ? {
                full_name: fullName || email.split('@')[0],
                role: 'owner' as AppRole,
                create_company: 'true',
                company_name: companyName.trim(),
              }
            : {
                full_name: fullName || email.split('@')[0],
                role,
                invite_code: inviteCode.trim().toUpperCase(),
              };

        const appUrl =
          (typeof window !== 'undefined' ? window.location.origin : '') ||
          process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
          '';

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: meta,
            emailRedirectTo: appUrl
              ? `${appUrl}/auth/callback`
              : undefined,
          },
        });
        if (signUpError) throw signUpError;

        // Confirm-email ON: Supabase creates the user and emails them; no session yet.
        if (!data.session) {
          if (!data.user) {
            throw new Error(
              'Could not create account. That email may already be registered — try signing in.'
            );
          }
          setInfo(
            'Check your email for a confirmation link from EasyDispatch, then come back here to sign in.'
          );
          setMode('signin');
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error('No user session');

      // Touch profile endpoint indirectly by reading — ensureProfile runs server-side on next page
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const dest =
        next ||
        homeForRole(
          ((profile?.role as AppRole) ||
            (signupPath === 'new_company' ? 'owner' : role)) as AppRole
        );

      router.replace(dest);
      router.refresh();
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel p-6 sm:p-8">
      <div className="mb-6 flex rounded-lg bg-ink-50 p-1">
        <button
          type="button"
          onClick={() => setMode('signin')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
            mode === 'signin'
              ? 'bg-white text-ink-900 shadow-sm'
              : 'text-ink-500 hover:text-ink-800'
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
            mode === 'signup'
              ? 'bg-white text-ink-900 shadow-sm'
              : 'text-ink-500 hover:text-ink-800'
          }`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === 'signup' && (
          <>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-ink-50 p-1">
              <button
                type="button"
                onClick={() => setSignupPath('new_company')}
                className={`rounded-md px-2 py-2 text-xs font-semibold sm:text-sm ${
                  signupPath === 'new_company'
                    ? 'bg-white text-ink-900 shadow-sm'
                    : 'text-ink-500'
                }`}
              >
                Start a company
              </button>
              <button
                type="button"
                onClick={() => setSignupPath('join_team')}
                className={`rounded-md px-2 py-2 text-xs font-semibold sm:text-sm ${
                  signupPath === 'join_team'
                    ? 'bg-white text-ink-900 shadow-sm'
                    : 'text-ink-500'
                }`}
              >
                Join with invite
              </button>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">
                Full name
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-ink-900 outline-none ring-brand-500/30 focus:ring-4"
                placeholder="Jordan Lee"
              />
            </label>

            {signupPath === 'new_company' ? (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink-700">
                  Company name
                </span>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-ink-900 outline-none ring-brand-500/30 focus:ring-4"
                  placeholder="DC Refrigeration"
                />
                <p className="mt-1 text-xs text-ink-400">
                  14-day free trial. Invite your team from Settings → Billing.
                </p>
              </label>
            ) : (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink-700">
                    Invite code
                  </span>
                  <input
                    type="text"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 font-mono uppercase tracking-wider text-ink-900 outline-none ring-brand-500/30 focus:ring-4"
                    placeholder="ABCD1234"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink-700">
                    Your role
                  </span>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as AppRole)}
                    className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-ink-900 outline-none ring-brand-500/30 focus:ring-4"
                  >
                    <option value="technician">Technician</option>
                    <option value="dispatcher">Dispatcher</option>
                    <option value="office">Office</option>
                  </select>
                </label>
              </>
            )}
          </>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-ink-900 outline-none ring-brand-500/30 focus:ring-4"
            placeholder="you@company.com"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">
            Password
          </span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={
              mode === 'signup' ? 'new-password' : 'current-password'
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-ink-900 outline-none ring-brand-500/30 focus:ring-4"
            placeholder="••••••••"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {loading
            ? 'Working…'
            : mode === 'signin'
              ? 'Sign in'
              : signupPath === 'new_company'
                ? 'Start free trial'
                : 'Join team'}
        </button>
      </form>
    </div>
  );
}
