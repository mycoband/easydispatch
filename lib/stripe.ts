import Stripe from 'stripe';

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key, {
    apiVersion: '2024-06-20',
  });
}

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'http://localhost:3000'
  );
}

export type PaymentLinkResult = {
  url: string | null;
  paymentLinkId?: string;
  simulated: boolean;
  error?: string;
};

/**
 * Create a Stripe Payment Link for a job invoice.
 * Without STRIPE_SECRET_KEY, returns null url (caller can fall back).
 */
export async function createJobPaymentLink(opts: {
  jobId: string;
  jobNumber: string | null;
  customerName: string | null;
  amountDollars: number;
}): Promise<PaymentLinkResult> {
  const stripe = getStripe();
  const amount = Math.round(opts.amountDollars * 100);
  if (!Number.isFinite(amount) || amount < 50) {
    return {
      url: null,
      simulated: false,
      error: 'Amount must be at least $0.50 for card payment',
    };
  }

  if (!stripe) {
    return { url: null, simulated: true };
  }

  try {
    const jobLabel = opts.jobNumber || opts.jobId.slice(0, 8);
    const productName = `Invoice ${jobLabel}${
      opts.customerName ? ` · ${opts.customerName}` : ''
    }`;

    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: amount,
      product_data: {
        name: productName,
        metadata: {
          job_id: opts.jobId,
          job_number: opts.jobNumber || '',
        },
      },
    });

    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        job_id: opts.jobId,
        job_number: opts.jobNumber || '',
      },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${appBaseUrl()}/pay/complete?job=${encodeURIComponent(opts.jobId)}`,
        },
      },
    });

    return {
      url: link.url,
      paymentLinkId: link.id,
      simulated: false,
    };
  } catch (err) {
    return {
      url: null,
      simulated: false,
      error: err instanceof Error ? err.message : 'Stripe payment link failed',
    };
  }
}
