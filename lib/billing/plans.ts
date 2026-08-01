export type PlanId = 'trial' | 'starter' | 'pro' | 'enterprise';

export type PlanDef = {
  id: Exclude<PlanId, 'trial'>;
  name: string;
  priceLabel: string;
  blurb: string;
  features: string[];
  /** Stripe Price ID from env (optional until configured). */
  priceEnv: string;
  seatHint: string;
  /** Shown on billing page but not self-serve checkout yet. */
  comingSoon?: boolean;
  seatLimit: number;
};

/**
 * SaaS tiers. Enterprise is the top tier — includes future AI SMS intake
 * (auto-reply, collect info, create customer + ticket). Ship that late; keep
 * the plan visible so pricing story is clear.
 */
export const PLANS: PlanDef[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceLabel: '$99/mo',
    blurb: 'Solo owner-operator or small crew getting off paper.',
    features: [
      'Up to 5 users',
      'Dispatch, jobs, invoices',
      'Customer + pricebook import',
      'Email support',
    ],
    priceEnv: 'STRIPE_PRICE_STARTER',
    seatHint: '5 seats',
    seatLimit: 5,
  },
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: '$199/mo',
    blurb: 'Growing shops that need estimates, inventory, and reporting.',
    features: [
      'Up to 25 users',
      'Everything in Starter',
      'GBB estimates, inventory, parts board',
      'AI ticket fill, plate scan, diagnostic',
      'Reports + accounting export',
      'Priority support',
    ],
    priceEnv: 'STRIPE_PRICE_PRO',
    seatHint: '25 seats',
    seatLimit: 25,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceLabel: 'Custom',
    blurb:
      'High-volume shops that want AI answering the phone line for them.',
    features: [
      'Unlimited seats (negotiated)',
      'Everything in Pro',
      'AI SMS intake receptionist (coming)',
      'Auto-create customers + tickets from texts',
      'Schedule-aware booking rules',
      'Dedicated onboarding',
    ],
    priceEnv: 'STRIPE_PRICE_ENTERPRISE',
    seatHint: 'Custom seats',
    seatLimit: 100,
    comingSoon: true,
  },
];

export function planPriceId(plan: PlanId): string | null {
  if (plan === 'trial') return null;
  const def = PLANS.find((p) => p.id === plan);
  if (!def) return null;
  return process.env[def.priceEnv]?.trim() || null;
}

export function planSeatLimit(plan: string | null | undefined): number {
  const def = PLANS.find((p) => p.id === plan);
  if (def) return def.seatLimit;
  if (plan === 'starter') return 5;
  if (plan === 'enterprise') return 100;
  return 25;
}

export function subscriptionAllowsAccess(status: string | null | undefined) {
  if (!status) return true;
  return ['trialing', 'active', 'past_due'].includes(status);
}
