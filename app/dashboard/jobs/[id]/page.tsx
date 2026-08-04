import Link from 'next/link';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { updateJob } from '@/app/dashboard/jobs/actions';
import { ConfirmationStatusBadge } from '@/components/jobs/ConfirmationStatusBadge';
import { DeleteJobButton } from '@/components/jobs/DeleteJobButton';
import { JobForm } from '@/components/jobs/JobForm';
import { JobStatusBadge } from '@/components/jobs/JobStatusBadge';
import { LineItemsEditor } from '@/components/jobs/LineItemsEditor';
import { LiveStatusBadge } from '@/components/jobs/LiveStatusBadge';
import { JobCostingPanel } from '@/components/jobs/JobCostingPanel';
import { TimeTrackingPanel } from '@/components/jobs/TimeTrackingPanel';
import { JobInvoicePanel } from '@/components/invoices/JobInvoicePanel';
import { JobMessageActions } from '@/components/messages/JobMessageActions';
import { JobMessageLog } from '@/components/messages/JobMessageLog';
import { JobPmChecklist } from '@/components/equipment/JobPmChecklist';
import { WarrantyBadge } from '@/components/equipment/WarrantyBadge';
import { pmChecklistPhotosAsAttachments } from '@/lib/equipment/pm-job-photos';
import { JobPartsOrders } from '@/components/jobs/JobPartsOrders';
import { JobPickTickets } from '@/components/jobs/JobPickTickets';
import { TechViewToggle } from '@/components/tech/TechViewToggle';
import { requireOffice } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import { roleHasPermission } from '@/lib/company/permissions';
import { loadJobFormOptions } from '@/lib/jobs/form-data';
import { computeCloseoutGaps } from '@/lib/jobs/closeout-gaps';
import { computeJobCosting, normalizeCosting } from '@/lib/jobs/costing';
import { deriveLiveStatus } from '@/lib/jobs/time-tracking';
import {
  excludeWalkthroughAttachments,
  filterWalkthroughAttachments,
  normalizeWalkthrough,
} from '@/lib/jobs/walkthrough';
import { formatMoney } from '@/lib/jobs/totals';
import { loadPricebookPresets } from '@/lib/pricebook/load';
import {
  JOB_DETAIL_COLUMNS,
  JOB_DETAIL_COLUMNS_NO_WALKTHROUGH,
} from '@/lib/jobs/select';
import { JobEstimatesPanel } from '@/components/estimates/JobEstimatesPanel';

const PanelPlaceholder = ({ label }: { label: string }) => (
  <div className="panel p-5 text-sm text-ink-500">{label}</div>
);

const JobWalkthroughPanel = dynamic(
  () =>
    import('@/components/tech/JobWalkthroughPanel').then((m) => ({
      default: m.JobWalkthroughPanel,
    })),
  { loading: () => <PanelPlaceholder label="Loading walkthrough…" /> }
);
const JobMediaPanel = dynamic(
  () =>
    import('@/components/tech/JobMediaPanel').then((m) => ({
      default: m.JobMediaPanel,
    })),
  { loading: () => <PanelPlaceholder label="Loading media…" /> }
);
const EquipmentSection = dynamic(
  () =>
    import('@/components/equipment/EquipmentSection').then((m) => ({
      default: m.EquipmentSection,
    })),
  { loading: () => <PanelPlaceholder label="Loading equipment…" /> }
);
const JobOfficeAssistant = dynamic(
  () =>
    import('@/components/jobs/JobOfficeAssistant').then((m) => ({
      default: m.JobOfficeAssistant,
    })),
  { loading: () => <PanelPlaceholder label="Loading assistant…" /> }
);

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ supabase, profile }, company] = await Promise.all([
    requireOffice(),
    loadCompanySettings(),
  ]);
  const mods = company.modules;
  const canViewCosts =
    mods.job_costing &&
    roleHasPermission(profile.role, 'view_job_costs', company.role_permissions);
  const canEditCosts =
    canViewCosts &&
    roleHasPermission(profile.role, 'edit_job_costs', company.role_permissions);

  // Dynamic column list loses supabase-js inference — cast after fetch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let job: any = null;
  let jobError: { message: string } | null = null;
  {
    const res = await supabase
      .from('jobs')
      .select(JOB_DETAIL_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    job = res.data;
    jobError = res.error;
  }

  if (
    jobError &&
    /walkthrough|column|schema cache/i.test(jobError.message)
  ) {
    const retry = await supabase
      .from('jobs')
      .select(JOB_DETAIL_COLUMNS_NO_WALKTHROUGH)
      .eq('id', id)
      .maybeSingle();
    job = retry.data;
    jobError = retry.error;
  }

  if (jobError || !job) notFound();

  const walkthrough = normalizeWalkthrough(job.walkthrough);

  const [
    lineItemsRes,
    options,
    { data: messages },
    { data: customer },
    presets,
    { data: equipment },
    attachRes,
    partOrdersRes,
    estimatesRes,
    techWageRes,
  ] = await Promise.all([
    supabase
      .from('line_items')
      .select(
        'id, description, qty, unit_price, unit_cost, item_type, taxable, sort_order'
      )
      .eq('job_id', id)
      .order('sort_order', { ascending: true }),
    loadJobFormOptions(supabase, { customerId: job.customer_id }),
    supabase
      .from('messages')
      .select('id, channel, direction, to_address, body, status, created_at')
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(30),
    job.customer_id
      ? supabase
          .from('customers')
          .select('phone, email')
          .eq('id', job.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    loadPricebookPresets(supabase),
    job.customer_id
      ? supabase
          .from('equipment')
          .select(
            'id, name, equipment_type, manufacturer, model, serial_number, capacity, electrical, refrigerant, filter_size, filter_qty, install_date, notes, photo_url, property_id, warranty_parts_expires, warranty_labor_expires, warranty_notes, pm_checklist'
          )
          .eq('customer_id', job.customer_id)
          .order('created_at', { ascending: true })
          .then(async (res) => {
            if (
              res.error &&
              /pm_checklist|column|schema cache/i.test(res.error.message)
            ) {
              return supabase
                .from('equipment')
                .select(
                  'id, name, equipment_type, manufacturer, model, serial_number, capacity, electrical, refrigerant, filter_size, filter_qty, install_date, notes, photo_url, property_id, warranty_parts_expires, warranty_labor_expires, warranty_notes'
                )
                .eq('customer_id', job.customer_id)
                .order('created_at', { ascending: true });
            }
            return res;
          })
      : Promise.resolve({ data: [] }),
    supabase
      .from('job_attachments')
      .select('id, kind, tag, url, caption, created_at, extract_json')
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('job_part_orders')
      .select(
        'id, description, sku, vendor, qty, unit_cost, status, eta_date, notes, ordered_at, received_at, created_at'
      )
      .eq('job_id', id)
      .order('created_at', { ascending: false }),
    mods.estimates
      ? supabase
          .from('estimates')
          .select(
            'id, estimate_number, customer_name, description, status, total, converted_job_id'
          )
          .eq('job_id', id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    job.assigned_to
      ? supabase
          .from('profiles')
          .select('hourly_cost, burden_pct')
          .eq('id', job.assigned_to)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let lineItems = lineItemsRes.data;
  if (lineItemsRes.error) {
    const fallback = await supabase
      .from('line_items')
      .select('id, description, qty, unit_price, taxable, sort_order')
      .eq('job_id', id)
      .order('sort_order', { ascending: true });
    lineItems = (fallback.data ?? []).map((row) => ({
      ...row,
      unit_cost: 0,
      item_type: 'other',
    }));
  }

  let rawAttachments: {
    id: string;
    kind: string;
    tag: string | null;
    url: string | null;
    caption: string | null;
    created_at: string;
    extract_json?: unknown;
  }[] = attachRes.error ? [] : ((attachRes.data ?? []) as typeof rawAttachments);
  if (attachRes.error && /extract_json/i.test(attachRes.error.message)) {
    const retry = await supabase
      .from('job_attachments')
      .select('id, kind, tag, url, caption, created_at')
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(40);
    rawAttachments = (retry.data ?? []) as typeof rawAttachments;
  }
  const partOrders = partOrdersRes.error ? [] : partOrdersRes.data ?? [];
  const pickTickets = rawAttachments
    .filter((a) => a.tag === 'pick_ticket' && a.kind === 'photo')
    .map((a) => ({
      id: a.id,
      url: a.url,
      caption: a.caption,
      created_at: a.created_at,
      extract_json:
        'extract_json' in a
          ? ((a as { extract_json?: unknown }).extract_json as
              | import('@/lib/grok').PickTicketExtraction
              | null
              | undefined) ?? null
          : null,
    }));
  const jobEstimates = estimatesRes.error ? [] : estimatesRes.data ?? [];

  const walkthroughMedia = filterWalkthroughAttachments(rawAttachments);
  // PM checklist photos for this job also appear under Job photos
  const attachments = excludeWalkthroughAttachments(
    pmChecklistPhotosAsAttachments(
      id,
      (equipment ?? []).map((e) => ({
        id: e.id,
        name: e.name,
        equipment_type: e.equipment_type,
        pm_checklist: (e as { pm_checklist?: unknown }).pm_checklist,
      })),
      excludeWalkthroughAttachments(rawAttachments)
    )
  ).filter((a) => a.tag !== 'pick_ticket');

  const updateAction = updateJob.bind(null, id);
  const hasPhone = Boolean(customer?.phone);
  const hasEmail = Boolean(customer?.email);
  const closeoutGaps = computeCloseoutGaps({
    checkOutAt: job.check_out_at,
    signatureData: null,
    signedAt: job.signed_at,
    total: Number(job.total) || 0,
    invoiceStatus: job.invoice_status,
    paymentStatus: job.payment_status,
    hasPhone,
    hasEmail,
    requireSignature: true,
    requireInvoice: Boolean(mods.invoices),
  });

  const partOrderCosts = partOrders
    .filter((o) =>
      ['received', 'installed', 'ordered'].includes(o.status || '')
    )
    .reduce(
      (s, o) => s + (Number(o.qty) || 0) * (Number(o.unit_cost) || 0),
      0
    );

  const costingSnapshot = canViewCosts
    ? computeJobCosting({
        lines: (lineItems ?? []).map((l) => ({
          qty: Number(l.qty) || 0,
          unit_price: Number(l.unit_price) || 0,
          unit_cost: Number((l as { unit_cost?: number }).unit_cost) || 0,
          item_type: (l as { item_type?: string }).item_type,
        })),
        revenue: Number(job.subtotal) || undefined,
        actual_hours: job.actual_hours,
        tech_hourly_cost: techWageRes.data?.hourly_cost ?? null,
        tech_burden_pct: techWageRes.data?.burden_pct ?? null,
        part_order_costs: partOrderCosts,
        costing: normalizeCosting(company.costing),
      })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/jobs"
            className="text-sm font-medium text-ink-500 hover:text-ink-800"
          >
            ← Jobs
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-ink-950">
              {job.customer_name || 'Job'}
            </h1>
            <LiveStatusBadge status={deriveLiveStatus(job)} />
            <JobStatusBadge status={job.status} />
            <ConfirmationStatusBadge status={job.confirmation_status} />
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {job.job_number || id.slice(0, 8)} · {job.job_type || 'Job'}
            {job.assigned_to_name ? ` · ${job.assigned_to_name}` : ' · Unassigned'}
            {' · '}
            {formatMoney(Number(job.total) || 0)}
          </p>
          {job.internal_notes && (
            <p className="mt-2 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <span className="font-semibold">Internal notes: </span>
              {job.internal_notes}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mods.tech_view_office && (
            <TechViewToggle
              enabled={false}
              variant="button"
              jobId={job.id}
            />
          )}
          <DeleteJobButton jobId={job.id} />
        </div>
      </div>

      <div id="job-time" className="scroll-mt-24">
        <TimeTrackingPanel jobId={job.id} job={job} />
      </div>

      {mods.ai && (
        <JobOfficeAssistant
          jobId={job.id}
          gaps={closeoutGaps}
          paymentStatus={job.payment_status}
        />
      )}

      {mods.ai_walkthrough && (
        <JobWalkthroughPanel
          jobId={job.id}
          walkthrough={walkthrough}
          media={walkthroughMedia}
          canEdit
          canMedia
          allowTranscribe={Boolean(mods.ai && mods.ai_walkthrough)}
          allowGenerate={Boolean(mods.ai && mods.ai_walkthrough)}
          allowPdf={Boolean(mods.ai_walkthrough && mods.print_pdfs)}
          heroCapture
        />
      )}

      {mods.estimates && (
        <JobEstimatesPanel
          jobId={job.id}
          customerName={job.customer_name}
          estimates={jobEstimates}
          newHref={`/dashboard/estimates/new?jobId=${job.id}`}
          estimateHref={(estId) => `/dashboard/estimates/${estId}`}
          canCreate={Boolean(job.customer_id)}
          createLabel="New estimate"
        />
      )}

      {(() => {
        const linked =
          (equipment ?? []).find((e) => e.id === job.equipment_id) || null;
        return linked ? <WarrantyBadge info={linked} /> : null;
      })()}

      {mods.equipment_timeline && job.customer_id && (
        <JobPmChecklist
          customerId={job.customer_id}
          jobId={job.id}
          equipmentId={job.equipment_id}
          equipment={
            (equipment ?? []).find((e) => e.id === job.equipment_id) || null
          }
          units={(equipment ?? []).map((e) => ({
            id: e.id,
            name: e.name,
            equipment_type: e.equipment_type,
            manufacturer: e.manufacturer,
            model: e.model,
            pm_checklist: (e as { pm_checklist?: unknown }).pm_checklist,
          }))}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {mods.tech_media ? (
          <JobMediaPanel
            jobId={job.id}
            attachments={attachments}
            customerApprovedAt={job.customer_approved_at}
            customerApprovedNote={job.customer_approved_note}
            allowVoiceTranscribe={Boolean(mods.ai && mods.tech_media)}
          />
        ) : (
          <div />
        )}
        {job.customer_id ? (
          <EquipmentSection
            customerId={job.customer_id}
            equipment={equipment ?? []}
            jobId={job.id}
            selectedEquipmentId={job.equipment_id}
          />
        ) : (
          <section className="panel p-5 text-sm text-ink-500">
            Assign a customer to this job to manage equipment and data plates.
          </section>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <section className="panel p-5">
          <h2 className="mb-4 font-display text-lg font-semibold text-ink-950">
            Job details
          </h2>
          <JobForm
            action={updateAction}
            customers={
              job.customer_id
                ? [
                    {
                      id: job.customer_id,
                      name: job.customer_name || 'Customer',
                    },
                  ]
                : []
            }
            equipmentByCustomer={options.equipmentByCustomer}
            propertiesByCustomer={options.propertiesByCustomer}
            techs={options.techs}
            taxRates={options.taxRates}
            initial={job}
            submitLabel="Save job"
            lockCustomer
          />
        </section>

        <LineItemsEditor
          jobId={job.id}
          taxRates={options.taxRates}
          initialTaxRateId={job.tax_rate_id || 'kcmo-jackson'}
          presets={presets}
          showCosts={canViewCosts}
          canEditCosts={canEditCosts}
          initialItems={(lineItems ?? []).map((item) => ({
            description: item.description,
            qty: Number(item.qty) || 0,
            unit_price: Number(item.unit_price) || 0,
            unit_cost: Number((item as { unit_cost?: number }).unit_cost) || 0,
            item_type: (item as { item_type?: string }).item_type,
            taxable: Boolean(item.taxable),
          }))}
        />
      </div>

      {mods.invoices && (
        <div id="job-invoice" className="scroll-mt-24">
          <JobInvoicePanel
            jobId={job.id}
            customerId={job.customer_id}
            total={Number(job.total) || 0}
            invoiceStatus={job.invoice_status}
            paymentStatus={job.payment_status}
            invoiceSentAt={job.invoice_sent_at}
            paymentMethod={job.payment_method}
            paymentLink={job.stripe_payment_link}
            hasPhone={hasPhone}
            hasEmail={hasEmail}
            allowPdf={Boolean(mods.print_pdfs)}
          />
        </div>
      )}

      {mods.part_orders && (
        <>
          <JobPickTickets
            jobId={job.id}
            jobNumber={job.job_number}
            tickets={pickTickets}
            enableAi={Boolean(mods.ai)}
          />
          <JobPartsOrders jobId={job.id} orders={partOrders} />
        </>
      )}

      {costingSnapshot && (
        <JobCostingPanel
          snapshot={costingSnapshot}
          coachEnabled={Boolean(mods.ai)}
        />
      )}

      {mods.messaging && (
        <div className="grid gap-6 lg:grid-cols-2">
          <JobMessageActions jobId={job.id} hasPhone={hasPhone} allowCustom />
          <JobMessageLog messages={messages ?? []} />
        </div>
      )}
    </div>
  );
}
