'use client';

import {
  InvoiceStatusBadge,
  PaymentStatusBadge,
} from '@/components/invoices/InvoiceStatusBadges';
import { InvoiceActions } from '@/components/invoices/InvoiceActions';
import { CreatePortalLinkButton } from '@/components/portal/CreatePortalLinkButton';
import { formatMoney } from '@/lib/jobs/totals';
import { formatTimestamp } from '@/lib/jobs/time-tracking';

export function JobInvoicePanel({
  jobId,
  customerId,
  total,
  invoiceStatus,
  paymentStatus,
  invoiceSentAt,
  paymentMethod,
  paymentLink,
  hasPhone,
  hasEmail,
  allowCashCheck = true,
  allowSend = true,
  allowPdf = true,
}: {
  jobId: string;
  customerId?: string | null;
  total: number;
  invoiceStatus: string | null;
  paymentStatus: string | null;
  invoiceSentAt: string | null;
  paymentMethod: string | null;
  paymentLink?: string | null;
  hasPhone: boolean;
  hasEmail: boolean;
  allowCashCheck?: boolean;
  allowSend?: boolean;
  allowPdf?: boolean;
}) {
  return (
    <section className="panel p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            Invoice
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Send to customer · Stripe link for card · cash/check
            {allowPdf ? ' · branded PDF' : ''}
          </p>
        </div>
        <p className="font-display text-xl font-semibold text-ink-950">
          {formatMoney(total)}
        </p>
      </div>

      <dl className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-ink-50 px-3 py-2">
          <dt className="text-ink-500">Invoice status</dt>
          <dd className="mt-1">
            <InvoiceStatusBadge status={invoiceStatus} />
          </dd>
        </div>
        <div className="rounded-lg bg-ink-50 px-3 py-2">
          <dt className="text-ink-500">Payment</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-2">
            <PaymentStatusBadge status={paymentStatus} />
            {paymentMethod && (
              <span className="text-xs text-ink-500">({paymentMethod})</span>
            )}
          </dd>
        </div>
        <div className="rounded-lg bg-ink-50 px-3 py-2 sm:col-span-2">
          <dt className="text-ink-500">Sent</dt>
          <dd className="mt-0.5 font-medium text-ink-900">
            {formatTimestamp(invoiceSentAt)}
          </dd>
        </div>
        {paymentLink && paymentStatus !== 'Paid' && (
          <div className="rounded-lg bg-ink-50 px-3 py-2 sm:col-span-2">
            <dt className="text-ink-500">Pay link</dt>
            <dd className="mt-0.5 break-all">
              <a
                href={paymentLink}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                {paymentLink}
              </a>
            </dd>
          </div>
        )}
      </dl>

      <InvoiceActions
        jobId={jobId}
        invoiceStatus={invoiceStatus}
        paymentStatus={paymentStatus}
        total={total}
        hasPhone={hasPhone}
        hasEmail={hasEmail}
        allowCashCheck={allowCashCheck}
        allowSend={allowSend}
        allowPdf={allowPdf}
      />

      {allowCashCheck && (
        <div className="mt-3">
          <CreatePortalLinkButton
            purpose="invoice"
            customerId={customerId || null}
            jobId={jobId}
            label="Customer invoice portal link"
          />
        </div>
      )}
    </section>
  );
}
