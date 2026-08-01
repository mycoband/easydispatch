import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NewEstimateBuilder } from '@/components/estimates/NewEstimateBuilder';
import { requireTech } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import { roleHasPermission } from '@/lib/company/permissions';
import { loadPricebookPresets } from '@/lib/pricebook/load';

export default async function TechNewJobEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: jobId } = await params;
  const [{ supabase, user, profile }, company] = await Promise.all([
    requireTech(),
    loadCompanySettings(),
  ]);

  if (!company.modules.estimates) notFound();
  if (
    !roleHasPermission(profile.role, 'manage_estimates', company.role_permissions)
  ) {
    notFound();
  }

  const { data: job } = await supabase
    .from('jobs')
    .select('id, job_number, customer_id, customer_name, assigned_to')
    .eq('id', jobId)
    .maybeSingle();

  if (!job || job.assigned_to !== user.id || !job.customer_id) {
    notFound();
  }

  const [{ data: customers }, { data: taxRates }, presets] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name')
      .eq('id', job.customer_id),
    supabase.from('tax_rates').select('id, name, rate').order('name'),
    loadPricebookPresets(supabase),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href={`/tech/jobs/${job.id}`}
          className="text-sm font-medium text-ink-500 hover:text-ink-800"
        >
          ← Job
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink-950">
          Build estimate
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          For {job.customer_name || 'customer'} · Job{' '}
          {job.job_number || job.id.slice(0, 8)}
        </p>
      </div>

      <NewEstimateBuilder
        customers={customers ?? []}
        taxRates={taxRates ?? []}
        initialCustomerId={job.customer_id}
        jobId={job.id}
        jobNumber={job.job_number}
        customerLocked
        successHref={(estId) => `/tech/estimates/${estId}`}
        presets={presets}
      />
    </div>
  );
}
