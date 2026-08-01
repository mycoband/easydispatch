import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  approveEstimateByIdViaPortal,
  approveEstimateViaPortal,
  approveGbbOptionViaPortal,
} from '@/app/portal/actions';
import { CompanyBrandHeader } from '@/components/brand/CompanyBrandHeader';
import { loadCompanySettingsAdmin } from '@/lib/company';
import { createServiceClient } from '@/lib/supabase/admin';
import { formatMoney } from '@/lib/jobs/totals';
import { cn } from '@/lib/utils';

type LineItemRow = {
  estimate_id?: string;
  description: string;
  qty: number;
  unit_price: number;
  taxable: boolean;
};

export default async function CustomerPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-ink-600">
        Portal unavailable — server config missing.
      </div>
    );
  }

  const { data: link } = await admin
    .from('portal_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (!link) notFound();

  const company = await loadCompanySettingsAdmin(link.company_id);

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <CompanyBrandHeader company={company} title="Link expired" />
        <p className="mt-2 text-sm text-ink-500">
          Ask the office to send a new link.
        </p>
      </div>
    );
  }

  if (link.purpose === 'estimate' && link.estimate_id) {
    const { data: estimate } = await admin
      .from('estimates')
      .select('*')
      .eq('id', link.estimate_id)
      .maybeSingle();

    if (!estimate) notFound();

    // ===== Good / Better / Best package: side-by-side comparison =====
    if (estimate.package_id) {
      const { data: options } = await admin
        .from('estimates')
        .select('*')
        .eq('package_id', estimate.package_id)
        .order('option_label', { ascending: true });

      const optionIds = (options ?? []).map((o) => o.id);
      const { data: allItems } = optionIds.length
        ? await admin
            .from('line_items')
            .select('estimate_id, description, qty, unit_price, taxable')
            .in('estimate_id', optionIds)
            .order('sort_order', { ascending: true })
        : { data: [] as LineItemRow[] };

      const itemsByEstimate = new Map<string, LineItemRow[]>();
      for (const item of allItems ?? []) {
        const key = item.estimate_id as string;
        const list = itemsByEstimate.get(key) ?? [];
        list.push(item);
        itemsByEstimate.set(key, list);
      }

      const approvedOption = (options ?? []).find(
        (o) => o.status === 'Approved'
      );

      return (
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-12">
          <CompanyBrandHeader
            company={company}
            eyebrow="Choose your option"
            title={estimate.customer_name || 'Estimate'}
            subtitle={estimate.description || undefined}
          />

          <div className="grid gap-4 md:grid-cols-3">
            {(options ?? []).map((opt) => {
              const items = itemsByEstimate.get(opt.id) ?? [];
              const approve = approveGbbOptionViaPortal.bind(
                null,
                token,
                opt.id
              );
              const isApproved = opt.status === 'Approved';
              const isRejected = opt.status === 'Rejected';

              return (
                <div
                  key={opt.id}
                  className={cn(
                    'panel flex flex-col p-5',
                    opt.is_recommended && 'border-brand-300 ring-2 ring-brand-200',
                    isRejected && 'opacity-60'
                  )}
                >
                  {opt.is_recommended && (
                    <p className="mb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                      Recommended
                    </p>
                  )}
                  <h2 className="text-center font-display text-xl font-semibold text-ink-950">
                    {opt.option_label}
                  </h2>
                  {opt.option_headline && (
                    <p className="mt-1 text-center text-sm text-ink-500">
                      {opt.option_headline}
                    </p>
                  )}

                  <ul className="mt-4 flex-1 space-y-2 border-t border-ink-100 pt-4 text-sm">
                    {items.map((item, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span>
                          {item.description}
                          {Number(item.qty) !== 1 && (
                            <span className="text-ink-400">
                              {' '}
                              ×{Number(item.qty)}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 border-t border-ink-100 pt-3 text-center">
                    <p className="font-display text-2xl font-semibold text-ink-950">
                      {formatMoney(Number(opt.total) || 0)}
                    </p>
                  </div>

                  {isApproved ? (
                    <p className="mt-4 rounded-lg bg-emerald-50 py-2 text-center text-sm font-semibold text-emerald-800">
                      Selected
                    </p>
                  ) : approvedOption ? (
                    <p className="mt-4 rounded-lg bg-ink-50 py-2 text-center text-sm text-ink-500">
                      Not selected
                    </p>
                  ) : (
                    <form action={approve}>
                      <button
                        type="submit"
                        className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                      >
                        Choose {opt.option_label}
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>

          {company.estimate_footer && (
            <p className="text-center text-xs text-ink-400">
              {company.estimate_footer}
            </p>
          )}
        </div>
      );
    }

    // ===== Single estimate =====
    const { data: items } = await admin
      .from('line_items')
      .select('description, qty, unit_price, taxable')
      .eq('estimate_id', link.estimate_id)
      .order('sort_order', { ascending: true });

    const approve = approveEstimateViaPortal.bind(null, token);

    return (
      <div className="mx-auto max-w-lg space-y-5 px-4 py-12">
        <CompanyBrandHeader
          company={company}
          eyebrow="Estimate"
          title={estimate.customer_name || 'Estimate'}
          subtitle={`${estimate.estimate_number || ''} · ${estimate.status}`}
        />

        <div className="panel p-5">
          <p className="text-sm text-ink-700 whitespace-pre-wrap">
            {estimate.description}
          </p>
          <ul className="mt-4 space-y-2 border-t border-ink-100 pt-4 text-sm">
            {(items ?? []).map((item, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>
                  {item.description}{' '}
                  <span className="text-ink-400">×{Number(item.qty)}</span>
                </span>
                <span>
                  {formatMoney(Number(item.qty) * Number(item.unit_price))}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-ink-100 pt-3 font-semibold">
            <span>Total</span>
            <span>{formatMoney(Number(estimate.total) || 0)}</span>
          </div>
        </div>

        {estimate.status !== 'Approved' && estimate.status !== 'Rejected' ? (
          <form action={approve}>
            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Approve estimate
            </button>
          </form>
        ) : (
          <p className="text-center text-sm font-medium text-emerald-700">
            Status: {estimate.status}
          </p>
        )}

        {company.estimate_footer && (
          <p className="text-center text-xs text-ink-400">
            {company.estimate_footer}
          </p>
        )}
      </div>
    );
  }

  if (link.purpose === 'invoice' && link.job_id) {
    const { data: job } = await admin
      .from('jobs')
      .select(
        'id, job_number, customer_name, total, invoice_status, payment_status, stripe_payment_link, customer_summary, notes'
      )
      .eq('id', link.job_id)
      .maybeSingle();

    if (!job) notFound();

    return (
      <div className="mx-auto max-w-lg space-y-5 px-4 py-12">
        <CompanyBrandHeader
          company={company}
          eyebrow="Invoice"
          title={job.customer_name || 'Invoice'}
          subtitle={job.job_number || undefined}
        />

        <div className="panel p-5 text-center">
          <p className="text-sm text-ink-500">Amount due</p>
          <p className="mt-1 font-display text-3xl font-semibold">
            {formatMoney(Number(job.total) || 0)}
          </p>
          <p className="mt-2 text-sm text-ink-600">
            {job.payment_status === 'Paid' ? 'Paid — thank you' : 'Unpaid'}
          </p>
          {(job.customer_summary || job.notes) && (
            <p className="mt-4 text-left text-sm text-ink-700 whitespace-pre-wrap">
              {job.customer_summary || job.notes}
            </p>
          )}
        </div>

        {job.payment_status !== 'Paid' && job.stripe_payment_link && (
          <a
            href={job.stripe_payment_link}
            className="block w-full rounded-xl bg-ink-900 py-3 text-center text-sm font-semibold text-white"
          >
            Pay online
          </a>
        )}

        {company.invoice_footer && (
          <p className="text-center text-xs text-ink-400">
            {company.invoice_footer}
          </p>
        )}

        <p className="text-center text-xs text-ink-400">
          <Link href="/" className="hover:underline">
            {company.name}
          </Link>
        </p>
      </div>
    );
  }

  if (link.purpose === 'customer' && link.customer_id) {
    if (!company.modules.portal) {
      return (
        <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-ink-600">
          Customer portal is turned off.
        </div>
      );
    }

    const { data: customer } = await admin
      .from('customers')
      .select('id, name, phone, email')
      .eq('id', link.customer_id)
      .maybeSingle();

    if (!customer) notFound();

    const [{ data: openJobs }, { data: pastJobs }, { data: estimates }, { data: invoices }] =
      await Promise.all([
        admin
          .from('jobs')
          .select(
            'id, job_number, job_type, status, scheduled_start, assigned_to_name'
          )
          .eq('customer_id', customer.id)
          .neq('status', 'Cancelled')
          .neq('status', 'Completed')
          .order('scheduled_start', { ascending: true, nullsFirst: false })
          .limit(20),
        admin
          .from('jobs')
          .select('id, job_number, job_type, status, scheduled_start, total')
          .eq('customer_id', customer.id)
          .eq('status', 'Completed')
          .order('scheduled_start', { ascending: false, nullsFirst: false })
          .limit(15),
        admin
          .from('estimates')
          .select(
            'id, estimate_number, description, status, total, option_label, package_id'
          )
          .eq('customer_id', customer.id)
          .in('status', ['Draft', 'Sent', 'Viewed'])
          .order('created_at', { ascending: false })
          .limit(10),
        admin
          .from('jobs')
          .select(
            'id, job_number, total, payment_status, invoice_status, stripe_payment_link'
          )
          .eq('customer_id', customer.id)
          .eq('invoice_status', 'Sent')
          .neq('payment_status', 'Paid')
          .order('invoice_sent_at', { ascending: false })
          .limit(10),
      ]);

    return (
      <div className="mx-auto max-w-lg space-y-5 px-4 py-12">
        <CompanyBrandHeader
          company={company}
          eyebrow="Your account"
          title={customer.name || 'Customer'}
          subtitle="Jobs, estimates, and invoices"
        />

        <section className="panel p-5">
          <h2 className="font-display text-base font-semibold text-ink-950">
            Open jobs
          </h2>
          {(openJobs ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-ink-400">No open jobs.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {(openJobs ?? []).map((j) => (
                <li
                  key={j.id}
                  className="rounded-lg border border-ink-100 bg-ink-50/50 px-3 py-2"
                >
                  <p className="font-medium">
                    {j.job_number || 'Job'} · {j.job_type || 'Service'}
                  </p>
                  <p className="text-xs text-ink-500">
                    {j.status}
                    {j.scheduled_start
                      ? ` · ${new Date(j.scheduled_start).toLocaleString()}`
                      : ''}
                    {j.assigned_to_name ? ` · ${j.assigned_to_name}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-base font-semibold text-ink-950">
            Estimates to review
          </h2>
          {(estimates ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-ink-400">No pending estimates.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {(estimates ?? []).map((est) => {
                const approve = approveEstimateByIdViaPortal.bind(
                  null,
                  token,
                  est.id
                );
                return (
                  <li
                    key={est.id}
                    className="rounded-lg border border-ink-100 px-3 py-2"
                  >
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {est.estimate_number || 'Estimate'}
                          {est.option_label ? ` · ${est.option_label}` : ''}
                        </p>
                        <p className="text-xs text-ink-500 line-clamp-2">
                          {est.description || est.status}
                        </p>
                      </div>
                      <p className="font-semibold">
                        {formatMoney(Number(est.total) || 0)}
                      </p>
                    </div>
                    <form action={approve} className="mt-2">
                      <button
                        type="submit"
                        className="w-full rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Approve estimate
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-base font-semibold text-ink-950">
            Unpaid invoices
          </h2>
          {(invoices ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-ink-400">Nothing due.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {(invoices ?? []).map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-100 px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{inv.job_number || 'Invoice'}</p>
                    <p className="text-xs text-ink-500">
                      {formatMoney(Number(inv.total) || 0)} due
                    </p>
                  </div>
                  {inv.stripe_payment_link ? (
                    <a
                      href={inv.stripe_payment_link}
                      className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Pay online
                    </a>
                  ) : (
                    <span className="text-xs text-ink-400">Contact office</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-base font-semibold text-ink-950">
            Recent completed
          </h2>
          {(pastJobs ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-ink-400">No past jobs yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {(pastJobs ?? []).map((j) => (
                <li
                  key={j.id}
                  className="flex justify-between gap-2 border-b border-ink-50 py-1.5 last:border-0"
                >
                  <span>
                    {j.job_number || 'Job'} · {j.job_type || 'Service'}
                  </span>
                  <span className="text-ink-600">
                    {formatMoney(Number(j.total) || 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-center text-xs text-ink-400">
          Questions? Call {company.phone || company.name}.
        </p>
      </div>
    );
  }

  notFound();
}
