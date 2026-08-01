import { getStripe, stripeConfigured } from '@/lib/stripe';
import { planPriceId, type PlanId } from '@/lib/billing/plans';
import { createServiceClient } from '@/lib/supabase/admin';

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'http://localhost:3000'
  );
}

export async function createSubscriptionCheckout(opts: {
  companyId: string;
  companyName: string;
  billingEmail: string;
  plan: PlanId;
  stripeCustomerId?: string | null;
}) {
  const stripe = getStripe();
  if (!stripe) {
    return { error: 'Stripe is not configured (set STRIPE_SECRET_KEY)' };
  }

  const priceId = planPriceId(opts.plan);
  if (!priceId) {
    return {
      error: `Missing Stripe price id for ${opts.plan}. Set STRIPE_PRICE_STARTER / STRIPE_PRICE_PRO.`,
    };
  }

  let customerId = opts.stripeCustomerId || undefined;
  const email = opts.billingEmail?.trim() || undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      name: opts.companyName,
      metadata: { company_id: opts.companyId },
    });
    customerId = customer.id;
    const admin = createServiceClient();
    await admin
      .from('companies')
      .update({
        stripe_customer_id: customerId,
        billing_email: email || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', opts.companyId);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    customer_email: customerId ? undefined : email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appBaseUrl()}/dashboard/settings/billing?success=1`,
    cancel_url: `${appBaseUrl()}/dashboard/settings/billing?canceled=1`,
    metadata: {
      company_id: opts.companyId,
      plan: opts.plan,
    },
    subscription_data: {
      metadata: {
        company_id: opts.companyId,
        plan: opts.plan,
      },
    },
    allow_promotion_codes: true,
  });

  return { url: session.url };
}

export async function createBillingPortalSession(opts: {
  stripeCustomerId: string;
}) {
  const stripe = getStripe();
  if (!stripe) {
    return { error: 'Stripe is not configured' };
  }
  if (!opts.stripeCustomerId) {
    return { error: 'No Stripe customer on this company yet' };
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: opts.stripeCustomerId,
    return_url: `${appBaseUrl()}/dashboard/settings/billing`,
  });
  return { url: session.url };
}

export async function syncCompanyFromSubscription(
  subscription: {
    id: string;
    status: string;
    customer: string | { id: string };
    items: { data: { price: { id: string } }[] };
    metadata?: Record<string, string>;
  },
  companyIdHint?: string | null
) {
  const admin = createServiceClient();
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  let companyId =
    companyIdHint || subscription.metadata?.company_id || null;

  if (!companyId) {
    const { data } = await admin
      .from('companies')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    companyId = data?.id ?? null;
  }

  if (!companyId) return { ok: false as const, error: 'Company not found' };

  const priceId = subscription.items.data[0]?.price?.id || null;
  const starter = process.env.STRIPE_PRICE_STARTER?.trim();
  const pro = process.env.STRIPE_PRICE_PRO?.trim();
  const enterprise = process.env.STRIPE_PRICE_ENTERPRISE?.trim();
  let plan = 'pro';
  if (priceId && starter && priceId === starter) plan = 'starter';
  if (priceId && pro && priceId === pro) plan = 'pro';
  if (priceId && enterprise && priceId === enterprise) plan = 'enterprise';

  const statusMap: Record<string, string> = {
    trialing: 'trialing',
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'unpaid',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    paused: 'past_due',
  };

  await admin
    .from('companies')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      plan,
      subscription_status: statusMap[subscription.status] || subscription.status,
      seat_limit:
        plan === 'starter' ? 5 : plan === 'enterprise' ? 100 : 25,
      updated_at: new Date().toISOString(),
    })
    .eq('id', companyId);

  return { ok: true as const, companyId };
}

export { stripeConfigured };
