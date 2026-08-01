import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { markJobPaidFromStripe } from '@/lib/invoices/mark-paid';
import { getStripe } from '@/lib/stripe';
import { syncCompanyFromSubscription } from '@/lib/stripe-billing';
import { createServiceClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

function jobIdFromSession(session: Stripe.Checkout.Session) {
  return (
    session.metadata?.job_id ||
    (typeof session.client_reference_id === 'string'
      ? session.client_reference_id
      : null)
  );
}

async function handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription') return null;
  const companyId = session.metadata?.company_id;
  const subId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;
  if (!subId) return { ok: false, error: 'Missing subscription' };

  const stripe = getStripe();
  if (!stripe) return { ok: false, error: 'Stripe missing' };

  const subscription = await stripe.subscriptions.retrieve(subId);
  return syncCompanyFromSubscription(
    {
      id: subscription.id,
      status: subscription.status,
      customer:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id,
      items: {
        data: subscription.items.data.map((i) => ({
          price: { id: i.price.id },
        })),
      },
      metadata: subscription.metadata as Record<string, string>,
    },
    companyId
  );
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: 'Stripe webhook not configured' },
      { status: 503 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Invalid webhook signature',
      },
      { status: 400 }
    );
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode === 'subscription') {
        const result = await handleSubscriptionCheckout(session);
        if (result && !result.ok) {
          return NextResponse.json(
            { error: result.error || 'Subscription sync failed' },
            { status: 500 }
          );
        }
        return NextResponse.json({ received: true, type: 'subscription' });
      }

      if (session.payment_status !== 'paid' && session.status !== 'complete') {
        return NextResponse.json({ received: true, skipped: true });
      }

      const jobId = jobIdFromSession(session);
      if (!jobId) {
        return NextResponse.json(
          { error: 'Missing job_id in session metadata' },
          { status: 400 }
        );
      }

      const paymentIntent =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id || session.id;

      const result = await markJobPaidFromStripe({
        jobId,
        stripePaymentId: paymentIntent,
        amountCents: session.amount_total,
      });

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error || 'Failed to mark paid' },
          { status: 500 }
        );
      }
    }

    if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const result = await syncCompanyFromSubscription({
        id: subscription.id,
        status:
          event.type === 'customer.subscription.deleted'
            ? 'canceled'
            : subscription.status,
        customer:
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id,
        items: {
          data: subscription.items.data.map((i) => ({
            price: { id: i.price.id },
          })),
        },
        metadata: subscription.metadata as Record<string, string>,
      });
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error || 'Sync failed' },
          { status: 500 }
        );
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id;
      if (customerId) {
        const admin = createServiceClient();
        await admin
          .from('companies')
          .update({
            subscription_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Webhook handler failed',
      },
      { status: 500 }
    );
  }
}
