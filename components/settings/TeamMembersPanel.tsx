'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createTeamMember,
  type TeamActionState,
} from '@/app/dashboard/settings/team-actions';
import { roleLabel, type AppRole } from '@/lib/roles';

type Member = {
  id: string;
  full_name: string | null;
  role: AppRole;
};

const initial: TeamActionState = {};

export function TeamMembersPanel({
  members,
  inviteCode,
  companyName,
}: {
  members: Member[];
  inviteCode: string | null;
  companyName: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(createTeamMember, initial);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const joinPath = inviteCode
    ? `/join?code=${encodeURIComponent(inviteCode)}`
    : '/join';

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.success, router]);

  async function copy(kind: 'code' | 'link', value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  }

  function joinLinkAbsolute() {
    if (typeof window === 'undefined') return joinPath;
    return `${window.location.origin}${joinPath}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Team
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Add technicians and office staff for {companyName}. They can sign in
          right away with the email and password you set.
        </p>
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="grid gap-3 rounded-xl border border-ink-100 bg-ink-50/40 p-4 sm:grid-cols-2"
      >
        <p className="sm:col-span-2 text-sm font-semibold text-ink-800">
          Add team member
        </p>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-700">
            Full name
          </span>
          <input
            name="full_name"
            required
            placeholder="Alex Rivera"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink-700">
            Role
          </span>
          <select
            name="role"
            defaultValue="technician"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          >
            <option value="technician">Technician</option>
            <option value="dispatcher">Dispatcher</option>
            <option value="office">Office</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-ink-700">
            Email (login)
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="alex@midwestcomfort.example"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-ink-700">
            Temporary password
          </span>
          <div className="flex gap-2">
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="shrink-0 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-600 hover:bg-ink-50"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-400">
            Share this with them once. They sign in at Login with this email.
          </p>
        </label>

        {state.error && (
          <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="sm:col-span-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {state.success}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 sm:col-span-2"
        >
          {pending ? 'Adding…' : 'Add to team'}
        </button>
      </form>

      <div>
        <h3 className="text-sm font-semibold text-ink-900">Current team</h3>
        <ul className="mt-2 divide-y divide-ink-100 rounded-xl border border-ink-100">
          {members.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-ink-400">
              No team members yet — add someone above.
            </li>
          ) : (
            members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="font-medium text-ink-900">
                  {m.full_name || 'User'}
                </span>
                <span className="text-ink-500">{roleLabel(m.role)}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      {inviteCode && (
        <div className="rounded-xl border border-dashed border-ink-200 px-4 py-3">
          <p className="text-sm font-semibold text-ink-800">
            Or share a self-serve join link
          </p>
          <p className="mt-1 text-xs text-ink-500">
            For people who should create their own password. Open in a private
            window if you&apos;re already signed in.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded bg-ink-50 px-2 py-1 font-mono text-sm tracking-wider">
              {inviteCode}
            </code>
            <button
              type="button"
              onClick={() => copy('code', inviteCode)}
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              {copied === 'code' ? 'Copied' : 'Copy code'}
            </button>
            <button
              type="button"
              onClick={() => copy('link', joinLinkAbsolute())}
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              {copied === 'link' ? 'Copied' : 'Copy join link'}
            </button>
            <Link
              href={joinPath}
              className="text-xs font-semibold text-ink-500 hover:underline"
            >
              Open join page
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
