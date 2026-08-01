import Link from 'next/link';
import { InvoiceActions } from '@/components/invoices/InvoiceActions';
import {
  InvoiceStatusBadge,
  PaymentStatusBadge,
} from '@/components/invoices/InvoiceStatusBadges';
import { requireOffice } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import { requireCompanyModule } from '@/lib/company/require-module';
import { formatTimestamp } from '@/lib/jobs/time-tracking';
import { formatMoney } from '@/lib/jobs/totals';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'not_sent', label: 'Not sent' },
  { value: 'sent', label: 'Sent (awaiting payment)' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
] as const;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  await requireCompanyModule('invoices');

  const [{ supabase }, company] = await Promise.all([
    requireOffice(),
    loadCompanySettings(),
  ]);
  const allowPdf = Boolean(company.modules.print_pdfs);
  const { q, filter: filterRaw } = await searchParams;
  const query = q?.trim() || '';
  const filter =
    FILTERS.find((f) => f.value === filterRaw)?.value || 'all';

  let request = supabase
    .from('jobs')
    .select(
      'id, job_number, customer_id, customer_name, assigned_to_name, status, total, subtotal, invoice_status, payment_status, invoice_sent_at, payment_method, created_at'
    )
    .neq('status', 'Cancelled')
    .order('invoice_sent_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);

  if (query) {
    request = request.or(
      `customer_name.ilike.%${query}%,job_number.ilike.%${query}%,assigned_to_name.ilike.%${query}%`
    );
  }

  const { data: jobs, error } = await request;

  const customerIds = [
    ...new Set(
      (jobs ?? [])
        .map((j) => j.customer_id)
        .filter(Boolean) as string[]
    ),
  ];
  const { data: customers } = customerIds.length
    ? await supabase
        .from('customers')
        .select('id, phone, email')
        .in('id', customerIds)
    : { data: [] };

  const contactById = new Map(
    (customers ?? []).map((c) => [
      c.id,
      { phone: c.phone, email: c.email },
    ])
  );

  const list = (jobs ?? []).filter((job) => {
    const total = Number(job.total) || 0;
    const hasAmount = total > 0 || Number(job.subtotal) > 0;
    const hasInvoiceActivity =
      job.invoice_status === 'Sent' || job.payment_status === 'Paid';
    // Match prototype: show jobs with money or invoice activity, or completed
    if (!hasAmount && !hasInvoiceActivity && job.status !== 'Completed') {
      return false;
    }

    if (filter === 'not_sent') {
      return job.invoice_status !== 'Sent' && job.payment_status !== 'Paid';
    }
    if (filter === 'sent') {
      return job.invoice_status === 'Sent' && job.payment_status !== 'Paid';
    }
    if (filter === 'unpaid') {
      return job.payment_status !== 'Paid' && job.invoice_status === 'Sent';
    }
    if (filter === 'paid') {
      return job.payment_status === 'Paid';
    }
    return true;
  });

  const notSent = (jobs ?? []).filter(
    (j) =>
      j.invoice_status !== 'Sent' &&
      j.payment_status !== 'Paid' &&
      (Number(j.total) > 0 || j.status === 'Completed')
  ).length;
  const awaiting = (jobs ?? []).filter(
    (j) => j.invoice_status === 'Sent' && j.payment_status !== 'Paid'
  ).length;
  const paid = (jobs ?? []).filter((j) => j.payment_status === 'Paid').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Invoices
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Office view — send, resend, track payment
          </p>
        </div>
      </div>

      <form className="panel flex flex-wrap gap-2 p-3">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search customer, job #, tech…"
          className="min-w-[220px] flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
        />
        <select
          name="filter"
          defaultValue={filter}
          className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
        >
          Filter
        </button>
        {(query || filter !== 'all') && (
          <Link
            href="/dashboard/invoices"
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-500 hover:text-ink-800"
          >
            Clear
          </Link>
        )}
      </form>

      <p className="text-xs text-ink-400">
        {notSent} not sent · {awaiting} awaiting payment · {paid} paid
      </p>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.message}
        </p>
      )}

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-ink-50/80 text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3 font-medium">Job</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Tech
              </th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                Invoice
              </th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                Payment
              </th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">
                Sent
              </th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {list.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-ink-400"
                >
                  No invoices match this filter. Add line items on a job, then
                  send from here.
                </td>
              </tr>
            ) : (
              list.map((job) => {
                const contact = job.customer_id
                  ? contactById.get(job.customer_id)
                  : undefined;
                const total = Number(job.total) || 0;
                return (
                  <tr key={job.id} className="hover:bg-ink-50/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/jobs/${job.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {job.job_number || job.id.slice(0, 8)}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {job.status}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-ink-800">
                      {job.customer_name || '—'}
                    </td>
                    <td className="hidden px-4 py-3 text-ink-600 md:table-cell">
                      {job.assigned_to_name || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-ink-900">
                      {formatMoney(total)}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <InvoiceStatusBadge status={job.invoice_status} />
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <PaymentStatusBadge status={job.payment_status} />
                    </td>
                    <td className="hidden px-4 py-3 text-ink-500 lg:table-cell">
                      {formatTimestamp(job.invoice_sent_at)}
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceActions
                        jobId={job.id}
                        invoiceStatus={job.invoice_status}
                        paymentStatus={job.payment_status}
                        total={total}
                        hasPhone={Boolean(contact?.phone)}
                        hasEmail={Boolean(contact?.email)}
                        allowPdf={allowPdf}
                        compact
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
