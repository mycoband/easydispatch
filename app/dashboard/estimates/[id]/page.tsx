import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateEstimate } from '@/app/dashboard/estimates/actions';
import { EstimateActions } from '@/components/estimates/EstimateActions';
import { EstimateForm } from '@/components/estimates/EstimateForm';
import { EstimateLineItemsEditor } from '@/components/estimates/EstimateLineItemsEditor';
import { GbbPackagePanel } from '@/components/estimates/GbbPackagePanel';
import { CreatePortalLinkButton } from '@/components/portal/CreatePortalLinkButton';
import { requireOffice } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import { roleHasPermission } from '@/lib/company/permissions';
import { computeJobCosting, normalizeCosting } from '@/lib/jobs/costing';
import { formatMoney } from '@/lib/jobs/totals';
import { loadPricebookPresets } from '@/lib/pricebook/load';
import { requireCompanyModule } from '@/lib/company/require-module';
import { EstimateCostingPanel } from '@/components/estimates/EstimateCostingPanel';

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCompanyModule('estimates');

  const { id } = await params;
  const [{ supabase, profile }, company] = await Promise.all([
    requireOffice(),
    loadCompanySettings(),
  ]);
  const showCosts =
    company.modules.job_costing &&
    roleHasPermission(profile.role, 'view_job_costs', company.role_permissions);

  const { data: estimate } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!estimate) notFound();

  const linkedJobId = estimate.job_id || estimate.converted_job_id;

  const [
    { data: lineItems },
    { data: customers },
    { data: taxRates },
    presets,
    siblingsRes,
    { data: linkedJob },
  ] = await Promise.all([
    supabase
      .from('line_items')
      .select(
        'id, description, qty, unit_price, unit_cost, item_type, taxable, sort_order'
      )
      .eq('estimate_id', id)
      .order('sort_order', { ascending: true }),
    supabase.from('customers').select('id, name').order('name').limit(500),
    supabase.from('tax_rates').select('id, name, rate').order('name'),
    loadPricebookPresets(supabase),
    estimate.package_id
      ? supabase
          .from('estimates')
          .select(
            'id, option_label, option_headline, status, total, is_recommended'
          )
          .eq('package_id', estimate.package_id)
          .order('option_label', { ascending: true })
      : Promise.resolve({ data: null, error: null }),
    linkedJobId
      ? supabase
          .from('jobs')
          .select('id, job_number, customer_name, customer_id, status')
          .eq('id', linkedJobId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const packageSiblings = siblingsRes.error ? [] : siblingsRes.data ?? [];
  const updateAction = updateEstimate.bind(null, id);

  const lines = (lineItems ?? []).map((item) => ({
    description: item.description,
    qty: Number(item.qty) || 0,
    unit_price: Number(item.unit_price) || 0,
    unit_cost: Number((item as { unit_cost?: number }).unit_cost) || 0,
    item_type: (item as { item_type?: string }).item_type,
    taxable: Boolean(item.taxable),
  }));

  const costingSnapshot = showCosts
    ? computeJobCosting({
        lines,
        revenue: Number(estimate.subtotal) || undefined,
        costing: normalizeCosting(company.costing),
      })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/estimates"
            className="text-sm font-medium text-ink-500 hover:text-ink-800"
          >
            ← Estimates
          </Link>
          <h1 className="mt-2 font-display text-2xl font-semibold text-ink-950">
            {estimate.estimate_number || 'Estimate'}
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            For{' '}
            {estimate.customer_id ? (
              <Link
                href={`/dashboard/customers/${estimate.customer_id}`}
                className="font-semibold text-ink-900 hover:text-brand-700 hover:underline"
              >
                {estimate.customer_name || 'Customer'}
              </Link>
            ) : (
              <span className="font-semibold">
                {estimate.customer_name || 'Customer'}
              </span>
            )}
            {linkedJob ? (
              <>
                {' '}
                · Job{' '}
                <Link
                  href={`/dashboard/jobs/${linkedJob.id}`}
                  className="font-semibold text-brand-700 hover:underline"
                >
                  {linkedJob.job_number || linkedJob.id.slice(0, 8)}
                </Link>
              </>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {estimate.status} · {formatMoney(Number(estimate.total) || 0)}
          </p>
          {estimate.converted_job_id && (
            <p className="mt-2 text-sm text-emerald-700">
              Applied to{' '}
              <Link
                href={`/dashboard/jobs/${estimate.converted_job_id}`}
                className="font-medium hover:underline"
              >
                job
              </Link>
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <EstimateActions
            estimateId={estimate.id}
            convertedJobId={estimate.converted_job_id}
            linkedJobId={estimate.job_id}
            status={estimate.status}
          />
          <CreatePortalLinkButton
            purpose="estimate"
            customerId={estimate.customer_id}
            estimateId={estimate.id}
            label="Customer portal link"
          />
        </div>
      </div>

      {estimate.package_id && packageSiblings.length > 0 && (
        <GbbPackagePanel
          currentEstimateId={estimate.id}
          siblings={packageSiblings}
        />
      )}

      {costingSnapshot && <EstimateCostingPanel snapshot={costingSnapshot} />}

      <EstimateLineItemsEditor
        estimateId={estimate.id}
        taxRates={taxRates ?? []}
        initialTaxRateId={estimate.tax_rate_id || 'kcmo-jackson'}
        presets={presets}
        showCosts={showCosts}
        initialItems={lines}
      />

      <section className="panel p-5">
        <h2 className="mb-4 font-display text-lg font-semibold text-ink-950">
          Estimate details
        </h2>
        <EstimateForm
          action={updateAction}
          customers={customers ?? []}
          taxRates={taxRates ?? []}
          initial={estimate}
          submitLabel="Save estimate"
        />
      </section>
    </div>
  );
}
