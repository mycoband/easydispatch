import type { createClient } from '@/lib/supabase/server';
import { sendAndLogOutboundSms } from '@/lib/messages/send';
import { invoiceSmsBody } from '@/lib/messages/templates';
import { formatMoney } from '@/lib/jobs/totals';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Used by invoices step — send + log invoice SMS. */
export async function sendInvoiceSms(
  supabase: Supabase,
  opts: {
    jobId: string;
    customerId: string | null;
    customerName: string | null;
    phone: string;
    total: number;
    paymentLink?: string | null;
  }
) {
  return sendAndLogOutboundSms(supabase, {
    jobId: opts.jobId,
    customerId: opts.customerId,
    to: opts.phone,
    body: invoiceSmsBody({
      customerName: opts.customerName,
      amountLabel: formatMoney(opts.total),
      link: opts.paymentLink,
    }),
    kind: 'invoice',
  });
}
