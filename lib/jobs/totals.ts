export type TotalsLine = {
  qty: number;
  unit_price: number;
  taxable: boolean;
};

export function computeJobTotals(items: TotalsLine[], taxRate: number) {
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + item.qty * item.unit_price, 0)
  );
  const taxableSubtotal = roundMoney(
    items
      .filter((item) => item.taxable)
      .reduce((sum, item) => sum + item.qty * item.unit_price, 0)
  );
  const tax_amount = roundMoney(taxableSubtotal * taxRate);
  const total = roundMoney(subtotal + tax_amount);
  return { subtotal, tax_amount, total, taxableSubtotal };
}

export function roundMoney(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n || 0);
}

export function toDatetimeLocalValue(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string | null | undefined) {
  const v = value?.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
