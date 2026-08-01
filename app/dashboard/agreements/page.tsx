import Link from 'next/link';
import {
  createAgreement,
  createMembershipInvoiceJob,
  createPmJobFromAgreement,
  deleteAgreement,
  markAgreementBilled,
} from '@/app/dashboard/agreements/actions';
import { AgreementCreateForm } from '@/components/agreements/AgreementCreateForm';
import { AgreementRowActions } from '@/components/agreements/AgreementRowActions';
import { requireOffice } from '@/lib/auth';
import { requireCompanyModule } from '@/lib/company/require-module';
import { formatMoney } from '@/lib/jobs/totals';

export default async function AgreementsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await requireCompanyModule('agreements');

  const { supabase } = await requireOffice();
  const { type } = await searchParams;
  const typeFilter = type === 'membership' ? 'membership' : type === 'pm' ? 'pm' : '';

  let request = supabase
    .from('service_agreements')
    .select('*')
    .order('next_due_date', { ascending: true, nullsFirst: false });

  if (typeFilter) request = request.eq('agreement_type', typeFilter);

  const [{ data: agreements, error }, { data: customers }] = await Promise.all([
    request,
    supabase.from('customers').select('id, name').order('name'),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const overdue = (agreements ?? []).filter(
    (a) =>
      a.status === 'Active' &&
      a.next_due_date &&
      a.next_due_date < today &&
      (a.agreement_type || 'pm') === 'pm'
  ).length;
  const billingDue = (agreements ?? []).filter(
    (a) =>
      a.status === 'Active' &&
      (a.agreement_type || 'pm') === 'membership' &&
      a.next_bill_date &&
      a.next_bill_date <= today
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Service agreements
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            PM plans & memberships · {overdue} PM overdue · {billingDue}{' '}
            billing due. Turn on Feature modules → PM job automation to
            auto-create due PM jobs nightly.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href="/dashboard/agreements"
            className={`rounded-lg px-3 py-1.5 ${!typeFilter ? 'bg-ink-900 text-white' : 'border border-ink-200'}`}
          >
            All
          </Link>
          <Link
            href="/dashboard/agreements?type=pm"
            className={`rounded-lg px-3 py-1.5 ${typeFilter === 'pm' ? 'bg-ink-900 text-white' : 'border border-ink-200'}`}
          >
            PM plans
          </Link>
          <Link
            href="/dashboard/agreements?type=membership"
            className={`rounded-lg px-3 py-1.5 ${typeFilter === 'membership' ? 'bg-ink-900 text-white' : 'border border-ink-200'}`}
          >
            Memberships
          </Link>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.message}
        </p>
      )}

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-ink-50/80 text-xs uppercase text-ink-500">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Plan</th>
              <th className="hidden px-4 py-3 md:table-cell">Type</th>
              <th className="hidden px-4 py-3 md:table-cell">Next due / bill</th>
              <th className="px-4 py-3 text-right">Monthly</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {(agreements ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-400">
                  No agreements yet. Create a PM or membership plan below.
                </td>
              </tr>
            ) : (
              (agreements ?? []).map((a) => {
                const isMembership = (a.agreement_type || 'pm') === 'membership';
                const overdueRow =
                  !isMembership &&
                  a.status === 'Active' &&
                  a.next_due_date &&
                  a.next_due_date < today;
                const billingDueRow =
                  isMembership &&
                  a.status === 'Active' &&
                  a.next_bill_date &&
                  a.next_bill_date <= today;
                return (
                  <tr
                    key={a.id}
                    className={overdueRow || billingDueRow ? 'bg-amber-50/40' : ''}
                  >
                    <td className="px-4 py-3 font-medium">
                      {a.customer_name}
                      <p className="text-xs text-ink-400">{a.status}</p>
                    </td>
                    <td className="px-4 py-3">
                      {a.plan_name}
                      <p className="text-xs text-ink-400">
                        {isMembership
                          ? `${a.billing_interval || 'monthly'} billing`
                          : `${a.visits_per_year} visits/yr`}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 capitalize md:table-cell">
                      {a.agreement_type || 'pm'}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {isMembership ? (
                        <>
                          {a.next_bill_date || '—'}
                          {billingDueRow && (
                            <span className="ml-1 text-xs font-semibold text-amber-800">
                              due
                            </span>
                          )}
                          {a.last_billed_at && (
                            <p className="text-xs text-ink-400">
                              Last billed{' '}
                              {new Date(a.last_billed_at).toLocaleDateString()}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          {a.next_due_date || '—'}
                          {overdueRow && (
                            <span className="ml-1 text-xs font-semibold text-amber-800">
                              overdue
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMoney(Number(a.monthly_amount) || 0)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AgreementRowActions
                        id={a.id}
                        showPm={!isMembership && a.status === 'Active'}
                        showMembership={isMembership && a.status === 'Active'}
                        createPm={createPmJobFromAgreement}
                        markBilled={markAgreementBilled}
                        createInvoiceJob={createMembershipInvoiceJob}
                        onDelete={deleteAgreement}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <section className="panel p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">
          New agreement / membership
        </h2>
        <AgreementCreateForm
          action={createAgreement}
          customers={customers ?? []}
        />
      </section>
    </div>
  );
}
