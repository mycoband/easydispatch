import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NewEstimateBuilder } from '@/components/estimates/NewEstimateBuilder';
import { requireOffice } from '@/lib/auth';
import { loadPricebookPresets } from '@/lib/pricebook/load';
import { requireCompanyModule } from '@/lib/company/require-module';

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; jobId?: string }>;
}) {
  await requireCompanyModule('estimates');

  const { supabase } = await requireOffice();
  const { customerId, jobId } = await searchParams;

  let linkedJob: {
    id: string;
    job_number: string | null;
    customer_id: string | null;
    customer_name: string | null;
  } | null = null;

  if (jobId) {
    const { data } = await supabase
      .from('jobs')
      .select('id, job_number, customer_id, customer_name')
      .eq('id', jobId)
      .maybeSingle();
    if (!data) notFound();
    linkedJob = data;
  }

  const lockedCustomerId = linkedJob?.customer_id || customerId;

  const [{ data: customers }, { data: taxRates }, presets] = await Promise.all([
    lockedCustomerId
      ? supabase
          .from('customers')
          .select('id, name')
          .eq('id', lockedCustomerId)
      : supabase.from('customers').select('id, name').order('name').limit(500),
    supabase.from('tax_rates').select('id, name, rate').order('name'),
    loadPricebookPresets(supabase),
  ]);

  const backHref = linkedJob
    ? `/dashboard/jobs/${linkedJob.id}`
    : '/dashboard/estimates';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href={backHref}
          className="text-sm font-medium text-ink-500 hover:text-ink-800"
        >
          ← {linkedJob ? 'Job' : 'Estimates'}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink-950">
          New estimate
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {linkedJob
            ? `For ${linkedJob.customer_name || 'customer'} · Job ${linkedJob.job_number || linkedJob.id.slice(0, 8)}`
            : 'Customer, scope, and line items in one screen — like a field quote.'}
        </p>
      </div>

      {(customers ?? []).length === 0 ? (
        <div className="panel p-6 text-sm text-ink-600">
          Add a customer first.{' '}
          <Link
            href="/dashboard/customers/new"
            className="font-medium text-brand-700"
          >
            New customer
          </Link>
        </div>
      ) : (
        <NewEstimateBuilder
          customers={customers ?? []}
          taxRates={taxRates ?? []}
          initialCustomerId={lockedCustomerId || undefined}
          jobId={linkedJob?.id}
          jobNumber={linkedJob?.job_number}
          customerLocked={Boolean(linkedJob)}
          presets={presets}
        />
      )}
    </div>
  );
}
