import Link from 'next/link';
import { requireOffice } from '@/lib/auth';
import { loadCompanyById } from '@/lib/tenant';
import { ensureOwnerRole } from '@/lib/tenant/ensure-owner';
import { stripeConfigured } from '@/lib/stripe';
import { BillingPanel } from '@/components/billing/BillingPanel';
import { createServiceClient } from '@/lib/supabase/admin';

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    locked?: string;
    success?: string;
    canceled?: string;
  }>;
}) {
  const ctx = await requireOffice();
  const profile = await ensureOwnerRole(ctx.profile);
  const params = await searchParams;

  let company = null;
  if (profile.company_id) {
    try {
      company = await loadCompanyById(profile.company_id);
      // Backfill invite code if missing
      if (company && !company.invite_code) {
        const code = Math.random().toString(36).slice(2, 10).toUpperCase();
        const admin = createServiceClient();
        await admin
          .from('companies')
          .update({ invite_code: code, updated_at: new Date().toISOString() })
          .eq('id', company.id);
        company = { ...company, invite_code: code };
      }
    } catch {
      company = null;
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard/settings"
          className="text-sm font-medium text-ink-500 hover:text-ink-800"
        >
          ← Settings
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink-950">
          Billing & plan
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Subscribe your shop to EasyDispatch. Customer invoice payments are
          separate (job Stripe links).
        </p>
      </div>

      <BillingPanel
        company={
          company
            ? {
                name: company.name,
                plan: company.plan,
                subscription_status: company.subscription_status,
                trial_ends_at: company.trial_ends_at,
                invite_code: company.invite_code,
                stripe_customer_id: company.stripe_customer_id,
              }
            : null
        }
        stripeReady={stripeConfigured()}
        locked={params.locked === '1'}
        success={params.success === '1'}
        canceled={params.canceled === '1'}
      />
    </div>
  );
}
