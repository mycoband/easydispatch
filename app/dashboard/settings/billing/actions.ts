'use server';

import { requireOffice } from '@/lib/auth';
import { loadCompanyById } from '@/lib/tenant';
import {
  createBillingPortalSession,
  createSubscriptionCheckout,
} from '@/lib/stripe-billing';
import { PLANS, type PlanId } from '@/lib/billing/plans';

export async function startCheckout(
  plan: PlanId
): Promise<{ url?: string; error?: string }> {
  try {
    const planDef = PLANS.find((p) => p.id === plan);
    if (!planDef || planDef.comingSoon || plan === 'trial') {
      return {
        error:
          'That plan is not available for self-serve checkout yet. Choose Starter or Pro, or contact sales for Enterprise.',
      };
    }

    const { profile } = await requireOffice();
    if (profile.role !== 'owner') {
      return { error: 'Only the company owner can manage billing' };
    }
    if (!profile.company_id) {
      return {
        error:
          'No company linked yet. Run supabase/multi-tenant-saas.sql, then sign out/in.',
      };
    }

    const company = await loadCompanyById(profile.company_id);
    if (!company) return { error: 'Company not found' };

    const result = await createSubscriptionCheckout({
      companyId: company.id,
      companyName: company.name,
      billingEmail: company.billing_email || '',
      plan,
      stripeCustomerId: company.stripe_customer_id,
    });

    if ('error' in result && result.error) return { error: result.error };
    if (!result.url) return { error: 'Could not create checkout session' };
    return { url: result.url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Checkout failed' };
  }
}

export async function openBillingPortal(): Promise<{
  url?: string;
  error?: string;
}> {
  try {
    const { profile } = await requireOffice();
    if (profile.role !== 'owner') {
      return { error: 'Only the company owner can manage billing' };
    }
    if (!profile.company_id) return { error: 'No company linked' };

    const company = await loadCompanyById(profile.company_id);
    if (!company?.stripe_customer_id) {
      return { error: 'Subscribe first — no Stripe customer yet' };
    }

    const result = await createBillingPortalSession({
      stripeCustomerId: company.stripe_customer_id,
    });
    if ('error' in result && result.error) return { error: result.error };
    if (!result.url) return { error: 'Could not open portal' };
    return { url: result.url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Portal failed' };
  }
}
