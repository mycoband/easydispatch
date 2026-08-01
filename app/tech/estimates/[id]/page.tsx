import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EstimateActions } from '@/components/estimates/EstimateActions';
import { EstimateLineItemsEditor } from '@/components/estimates/EstimateLineItemsEditor';
import { requireTech } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import { roleHasPermission } from '@/lib/company/permissions';
import { formatMoney } from '@/lib/jobs/totals';
import { loadPricebookPresets } from '@/lib/pricebook/load';

export default async function TechEstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: estimate } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!estimate?.job_id) notFound();

  const { data: job } = await supabase
    .from('jobs')
    .select('id, job_number, customer_name, customer_id, assigned_to')
    .eq('id', estimate.job_id)
    .maybeSingle();

  if (!job || job.assigned_to !== user.id) notFound();

  const [{ data: lineItems }, { data: taxRates }, presets] = await Promise.all([
    supabase
      .from('line_items')
      .select('id, description, qty, unit_price, taxable, sort_order')
      .eq('estimate_id', id)
      .order('sort_order', { ascending: true }),
    supabase.from('tax_rates').select('id, name, rate').order('name'),
    loadPricebookPresets(supabase),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/tech/jobs/${job.id}`}
            className="text-sm font-medium text-ink-500 hover:text-ink-800"
          >
            ← Job
          </Link>
          <h1 className="mt-2 font-display text-2xl font-semibold text-ink-950">
            {estimate.estimate_number || 'Estimate'}
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            For{' '}
            <span className="font-semibold">
              {estimate.customer_name || job.customer_name || 'Customer'}
            </span>
            {' · '}
            Job{' '}
            <Link
              href={`/tech/jobs/${job.id}`}
              className="font-semibold text-brand-700 hover:underline"
            >
              {job.job_number || job.id.slice(0, 8)}
            </Link>
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {estimate.status} · {formatMoney(Number(estimate.total) || 0)}
          </p>
        </div>
        <EstimateActions
          estimateId={estimate.id}
          convertedJobId={estimate.converted_job_id}
          linkedJobId={estimate.job_id}
          status={estimate.status}
        />
      </div>

      <EstimateLineItemsEditor
        estimateId={estimate.id}
        taxRates={taxRates ?? []}
        initialTaxRateId={estimate.tax_rate_id || 'kcmo-jackson'}
        presets={presets}
        initialItems={(lineItems ?? []).map((item) => ({
          description: item.description,
          qty: Number(item.qty) || 0,
          unit_price: Number(item.unit_price) || 0,
          taxable: Boolean(item.taxable),
        }))}
      />
    </div>
  );
}
