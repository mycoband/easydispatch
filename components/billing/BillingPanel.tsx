'use client';

import { useState, useTransition } from 'react';
import { PLANS, type PlanId } from '@/lib/billing/plans';
import {
  openBillingPortal,
  startCheckout,
} from '@/app/dashboard/settings/billing/actions';

export function BillingPanel({
  company,
  stripeReady,
  locked,
  success,
  canceled,
}: {
  company: {
    name: string;
    plan: string;
    subscription_status: string;
    trial_ends_at: string | null;
    invite_code: string | null;
    stripe_customer_id: string | null;
  } | null;
  stripeReady: boolean;
  locked?: boolean;
  success?: boolean;
  canceled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function checkout(plan: PlanId) {
    setError(null);
    startTransition(async () => {
      const res = await startCheckout(plan);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.url) window.location.href = res.url;
    });
  }

  function portal() {
    setError(null);
    startTransition(async () => {
      const res = await openBillingPortal();
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.url) window.location.href = res.url;
    });
  }

  const trialEnd = company?.trial_ends_at
    ? new Date(company.trial_ends_at).toLocaleDateString()
    : null;

  return (
    <div className="space-y-6">
      {locked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Your trial has ended or billing needs attention. Choose a plan to
          keep dispatching.
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Subscription updated — welcome aboard.
        </div>
      )}
      {canceled && (
        <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-700">
          Checkout canceled. You can pick a plan anytime.
        </div>
      )}

      <section className="panel space-y-3 p-5">
        <h2 className="font-display text-lg font-semibold">Current plan</h2>
        {company ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-500">Company</dt>
              <dd className="font-medium">{company.name}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Plan</dt>
              <dd className="font-medium capitalize">{company.plan}</dd>
            </div>
            <div>
              <dt className="text-ink-500">Status</dt>
              <dd className="font-medium capitalize">
                {company.subscription_status.replace('_', ' ')}
              </dd>
            </div>
            <div>
              <dt className="text-ink-500">Trial ends</dt>
              <dd className="font-medium">{trialEnd || '—'}</dd>
            </div>
            {company.invite_code && (
              <div className="sm:col-span-2">
                <dt className="text-ink-500">Team invite code</dt>
                <dd className="mt-0.5 font-mono text-base font-semibold tracking-wider text-ink-900">
                  {company.invite_code}
                </dd>
                <p className="mt-1 text-xs text-ink-400">
                  Techs and office staff enter this when creating their account.
                </p>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-ink-500">
            Run <code className="font-mono">supabase/multi-tenant-saas.sql</code>{' '}
            then sign out and back in to activate company billing.
          </p>
        )}

        {company?.stripe_customer_id && (
          <button
            type="button"
            disabled={pending || !stripeReady}
            onClick={portal}
            className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50 disabled:opacity-50"
          >
            Manage payment method
          </button>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`panel flex flex-col p-5 ${
              plan.id === 'enterprise'
                ? 'border-violet-200 ring-1 ring-violet-100'
                : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                {plan.name}
              </p>
              {plan.comingSoon && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                  Later release
                </span>
              )}
            </div>
            <p className="mt-1 font-display text-3xl font-semibold text-ink-950">
              {plan.priceLabel}
            </p>
            <p className="mt-2 text-sm text-ink-500">{plan.blurb}</p>
            <ul className="mt-4 flex-1 space-y-1.5 text-sm text-ink-700">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-brand-600">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {plan.comingSoon ? (
              <p className="mt-5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-center text-sm font-medium text-violet-950">
                AI SMS intake ships later — contact sales when ready
              </p>
            ) : (
              <button
                type="button"
                disabled={pending || !stripeReady || !company}
                onClick={() => checkout(plan.id)}
                className="mt-5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {pending ? 'Redirecting…' : `Choose ${plan.name}`}
              </button>
            )}
          </div>
        ))}
      </section>

      {!stripeReady && (
        <p className="text-sm text-ink-500">
          Billing checkout needs <code className="font-mono">STRIPE_SECRET_KEY</code>{' '}
          plus <code className="font-mono">STRIPE_PRICE_STARTER</code> /{' '}
          <code className="font-mono">STRIPE_PRICE_PRO</code> in{' '}
          <code className="font-mono">.env.local</code>.
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
