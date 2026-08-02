/** Deterministic closeout / invoice-readiness checklist (tech Wrap + office Job assistant). */

export type CloseoutGapId =
  | 'clock_out'
  | 'signature'
  | 'pricing'
  | 'send_invoice'
  | 'paid';

export type CloseoutGap = {
  id: CloseoutGapId;
  label: string;
  done: boolean;
  hint: string;
  /** Anchor for scroll/jump on the page */
  anchor: string;
  /** True when this step is blocked by missing contact (send) */
  blocked?: boolean;
};

export type CloseoutGapsInput = {
  checkOutAt: string | null | undefined;
  signatureData: string | null | undefined;
  signedAt: string | null | undefined;
  total: number | null | undefined;
  invoiceStatus: string | null | undefined;
  paymentStatus: string | null | undefined;
  hasPhone: boolean;
  hasEmail: boolean;
  /** Include signature step (module + permission) */
  requireSignature?: boolean;
  /** Include pricing / send / paid steps (invoices module + send or record perm) */
  requireInvoice?: boolean;
};

export function computeCloseoutGaps(input: CloseoutGapsInput): CloseoutGap[] {
  const requireSignature = input.requireSignature !== false;
  const requireInvoice = input.requireInvoice !== false;
  const paid = input.paymentStatus === 'Paid';
  const sent = input.invoiceStatus === 'Sent' || paid;
  const priced = Number(input.total) > 0;
  const canContact = input.hasPhone || input.hasEmail;
  const signed = Boolean(input.signatureData && input.signedAt);
  const clockedOut = Boolean(input.checkOutAt);

  const gaps: CloseoutGap[] = [
    {
      id: 'clock_out',
      label: 'Clock out',
      done: clockedOut,
      hint: clockedOut
        ? 'Clocked out'
        : 'Clock out when you leave the site',
      anchor: 'finish-clock-out',
    },
  ];

  if (requireSignature) {
    gaps.push({
      id: 'signature',
      label: 'Customer signature',
      done: signed,
      hint: signed
        ? 'Signed'
        : 'Capture signature on Wrap',
      anchor: 'finish-signature',
    });
  }

  if (requireInvoice) {
    gaps.push({
      id: 'pricing',
      label: 'Add pricing',
      done: priced,
      hint: priced
        ? `Total $${Number(input.total).toFixed(2)}`
        : 'Add line items so total is greater than $0',
      anchor: 'finish-invoice',
    });

    const sendBlocked = priced && !canContact && !sent;
    gaps.push({
      id: 'send_invoice',
      label: 'Send invoice',
      done: sent,
      blocked: sendBlocked,
      hint: sent
        ? 'Invoice sent'
        : sendBlocked
          ? 'Add customer phone or email before sending'
          : !priced
            ? 'Price the job first'
            : 'Send SMS or email pay link',
      anchor: 'finish-invoice',
    });

    gaps.push({
      id: 'paid',
      label: 'Collect payment',
      done: paid,
      hint: paid
        ? 'Paid'
        : 'Mark cash/check or wait for Stripe',
      anchor: 'finish-invoice',
    });
  }

  return gaps;
}

/** First incomplete step, or null when stop is complete for required steps. */
export function firstIncompleteCloseoutGap(
  gaps: CloseoutGap[]
): CloseoutGap | null {
  // "paid" is informational for sticky copy — stop is "complete" once send is done
  // (or paid). Signature/clock/pricing must still be done when included.
  for (const g of gaps) {
    if (g.id === 'paid') continue;
    if (!g.done) return g;
  }
  return null;
}

export function closeoutStickyHint(gaps: CloseoutGap[]): string {
  const first = firstIncompleteCloseoutGap(gaps);
  if (!first) {
    const unpaid = gaps.find((g) => g.id === 'paid' && !g.done);
    if (unpaid) return 'Invoice sent — collect payment or mark cash/check';
    return 'Stop complete — Back to My jobs when you’re done';
  }
  if (first.blocked) return first.hint;
  return first.hint;
}
