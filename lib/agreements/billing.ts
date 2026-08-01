export const BILLING_INTERVALS = [
  'monthly',
  'quarterly',
  'yearly',
  'none',
] as const;

export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export function normalizeBillingInterval(value: string): BillingInterval {
  return BILLING_INTERVALS.includes(value as BillingInterval)
    ? (value as BillingInterval)
    : 'monthly';
}
