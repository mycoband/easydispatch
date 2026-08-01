'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  recordCashCheckPayment,
  sendInvoice,
} from '@/app/dashboard/invoices/actions';
import { cn } from '@/lib/utils';

export function InvoiceActions({
  jobId,
  invoiceStatus,
  paymentStatus,
  total,
  hasPhone,
  hasEmail,
  allowCashCheck = true,
  allowSend = true,
  compact = false,
}: {
  jobId: string;
  invoiceStatus: string | null;
  paymentStatus: string | null;
  total: number;
  hasPhone: boolean;
  hasEmail: boolean;
  allowCashCheck?: boolean;
  allowSend?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paid = paymentStatus === 'Paid';
  const sent = invoiceStatus === 'Sent';
  const canSend =
    allowSend && total > 0 && (hasPhone || hasEmail) && !paid;

  async function runSend(channel: 'auto' | 'sms' | 'email' = 'auto') {
    setPending(`send:${channel}`);
    setError(null);
    setMessage(null);
    const result = await sendInvoice(jobId, channel);
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Invoice sent');
      router.refresh();
    }
    setPending(null);
  }

  async function runCashCheck(method: 'cash' | 'check') {
    setPending(method);
    setError(null);
    setMessage(null);
    const result = await recordCashCheckPayment(jobId, method);
    if (result.error) setError(result.error);
    else {
      setMessage(result.success || 'Paid');
      router.refresh();
    }
    setPending(null);
  }

  const btn = compact
    ? 'rounded-lg px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50'
    : 'rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50';

  return (
    <div className={cn('space-y-2', compact ? '' : '')}>
      {!paid && (allowSend || allowCashCheck) && (
        <div className={cn('flex flex-wrap gap-1.5', compact && 'justify-end')}>
          {allowSend && (
            <button
              type="button"
              disabled={!canSend || Boolean(pending)}
              onClick={() => runSend('auto')}
              className={cn(
                btn,
                canSend
                  ? 'bg-ink-900 text-white hover:bg-ink-800'
                  : 'bg-ink-100 text-ink-400'
              )}
              title={
                total <= 0
                  ? 'Add priced line items first'
                  : !hasPhone && !hasEmail
                    ? 'Customer needs phone or email'
                    : sent
                      ? 'Resend invoice'
                      : 'Send invoice'
              }
            >
              {pending?.startsWith('send')
                ? 'Sending…'
                : sent
                  ? 'Resend'
                  : 'Send invoice'}
            </button>
          )}
          {allowCashCheck && (
            <>
              <button
                type="button"
                disabled={Boolean(pending)}
                onClick={() => runCashCheck('cash')}
                className={cn(
                  btn,
                  'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
                )}
              >
                {pending === 'cash' ? '…' : 'Cash'}
              </button>
              <button
                type="button"
                disabled={Boolean(pending)}
                onClick={() => runCashCheck('check')}
                className={cn(
                  btn,
                  'border border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
                )}
              >
                {pending === 'check' ? '…' : 'Check'}
              </button>
            </>
          )}
        </div>
      )}
      {paid && (
        <p className={cn('text-emerald-700', compact ? 'text-xs' : 'text-sm')}>
          Paid
          {!compact ? ' — card payments update automatically via Stripe' : ''}
        </p>
      )}
      {!compact && message && (
        <p className="text-sm text-emerald-700">{message}</p>
      )}
      {!compact && error && <p className="text-sm text-red-700">{error}</p>}
      {compact && error && (
        <p className="text-right text-[10px] text-red-600">{error}</p>
      )}
    </div>
  );
}
