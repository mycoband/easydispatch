import Link from 'next/link';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { LiveStatusBadge } from '@/components/jobs/LiveStatusBadge';
import { JobInvoicePanel } from '@/components/invoices/JobInvoicePanel';
import { JobMessageActions } from '@/components/messages/JobMessageActions';
import { JobMessageLog } from '@/components/messages/JobMessageLog';
import { TechCustomerDraftHost } from '@/components/tech/TechCustomerDraftHost';
import { JobPmChecklist } from '@/components/equipment/JobPmChecklist';
import { WarrantyBadge } from '@/components/equipment/WarrantyBadge';
import { pmChecklistPhotosAsAttachments } from '@/lib/equipment/pm-job-photos';
import { JobPartsOrders } from '@/components/jobs/JobPartsOrders';
import { JobPickTickets } from '@/components/jobs/JobPickTickets';
import { SafetyChecklist } from '@/components/tech/SafetyChecklist';
import { SignaturePad } from '@/components/tech/SignaturePad';
import { FinishThisStopStrip } from '@/components/tech/FinishThisStopStrip';
import { OfflineSyncBanner } from '@/components/tech/OfflineSyncBanner';
import { TechCollapsibleSection } from '@/components/tech/TechCollapsibleSection';
import { TechJobNotes } from '@/components/tech/TechJobNotes';
import { TechJobPacket } from '@/components/tech/TechJobPacket';
import { TechJobTicketShell } from '@/components/tech/TechJobTicketShell';
import { TruckStockDeduct } from '@/components/tech/TruckStockDeduct';
import { JobEstimatesPanel } from '@/components/estimates/JobEstimatesPanel';
import { requireTechApp } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import { roleHasPermission } from '@/lib/company/permissions';
import {
  closeoutStickyHint,
  computeCloseoutGaps,
} from '@/lib/jobs/closeout-gaps';
import { deriveLiveStatus, formatTimestamp } from '@/lib/jobs/time-tracking';
import {
  excludeWalkthroughAttachments,
  filterWalkthroughAttachments,
  normalizeWalkthrough,
} from '@/lib/jobs/walkthrough';
import {
  JOB_DETAIL_COLUMNS,
  JOB_DETAIL_COLUMNS_NO_WALKTHROUGH,
} from '@/lib/jobs/select';
import { mapsDirectionsUrl } from '@/lib/tech/maps';
import type { SafetyChecklistState } from '@/lib/tech/safety';
import { formatAddress } from '@/lib/utils';

const PanelPlaceholder = ({ label }: { label: string }) => (
  <div className="rounded-xl border border-ink-100 bg-white p-4 text-sm text-ink-500">
    {label}
  </div>
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
const DiagnosticAssist = dynamic(
  () =>
    import('@/components/tech/DiagnosticAssist').then((m) => ({
      default: m.DiagnosticAssist,
    })),
  { loading: () => <PanelPlaceholder label="Loading diagnostic…" /> }
);
const EquipmentSection = dynamic(
  () =>
    import('@/components/equipment/EquipmentSection').then((m) => ({
      default: m.EquipmentSection,
    })),
  { loading: () => <PanelPlaceholder label="Loading equipment…" /> }
);

export default async function TechJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ supabase, user, profile, techViewPreview }, company] =
    await Promise.all([requireTechApp(), loadCompanySettings()]);
  const mods = company.modules;
  const rp = company.role_permissions;
  const allow = (key: Parameters<typeof roleHasPermission>[1]) =>
    roleHasPermission(profile.role, key, rp);

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

  if (jobError || !job) {
    notFound();
  }
  if (!techViewPreview && job.assigned_to !== user.id) {
    notFound();
  }
  if (
    techViewPreview &&
    profile.company_id &&
    job.company_id &&
    job.company_id !== profile.company_id
  ) {
    notFound();
  }

  const walkthrough = normalizeWalkthrough(job.walkthrough);

  const [
    { data: customer },
    { data: messages },
    { data: equipment },
    { data: recentVisits },
    attachRes,
    { data: inventory },
    partOrdersRes,
    estimatesRes,
    { data: signatureRow },
  ] = await Promise.all([
    job.customer_id
      ? supabase
          .from('customers')
          .select(
            'address, city, state, zip, phone, email, notes, access_notes'
          )
          .eq('id', job.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('messages')
      .select('id, channel, direction, to_address, body, status, created_at')
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
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
    job.customer_id
      ? supabase
          .from('jobs')
          .select(
            'id, job_number, job_type, diagnosis, scheduled_start, created_at, is_callback'
          )
          .eq('customer_id', job.customer_id)
          .neq('id', id)
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    supabase
      .from('job_attachments')
      .select('id, kind, tag, url, caption, created_at, extract_json')
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('inventory_items')
      .select('id, name, qty_on_hand, location, sku')
      .order('name')
      .limit(100),
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
    // Signature PNG is large — load only for SignaturePad, not on the main job row.
    supabase
      .from('jobs')
      .select('signature_data')
      .eq('id', id)
      .maybeSingle(),
  ]);

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
  const canBuildEstimate =
    mods.estimates &&
    Boolean(job.customer_id) &&
    allow('manage_estimates');

  const linkedEquipment =
    (equipment ?? []).find((e) => e.id === job.equipment_id) ||
    (equipment ?? [])[0] ||
    null;

  const walkthroughMedia = filterWalkthroughAttachments(rawAttachments);
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

  let site = null as {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    access_notes?: string | null;
    gate_code?: string | null;
    lockbox_code?: string | null;
  } | null;

  if (job.property_id) {
    const { data } = await supabase
      .from('properties')
      .select(
        'name, address, city, state, zip, access_notes, gate_code, lockbox_code'
      )
      .eq('id', job.property_id)
      .maybeSingle();
    site = data;
  }

  const accessBits = [
    site?.gate_code && `Gate ${site.gate_code}`,
    site?.lockbox_code && `Lockbox ${site.lockbox_code}`,
    site?.access_notes || customer?.access_notes,
  ]
    .filter(Boolean)
    .join(' · ');

  const packet = {
    jobId: job.id,
    customerName: job.customer_name,
    address: {
      address: site?.address || customer?.address,
      city: site?.city || customer?.city,
      state: site?.state || customer?.state,
      zip: site?.zip || customer?.zip,
      phone: customer?.phone,
    },
    accessNotes: accessBits || null,
    customerNotes: customer?.notes ?? null,
    internalNotes: job.internal_notes,
    equipment: equipment ?? [],
    recentVisits: recentVisits ?? [],
    cachedAt: new Date().toISOString(),
  };

  const liveStatus = deriveLiveStatus(job);
  const addressParts = {
    address: site?.address || customer?.address,
    city: site?.city || customer?.city,
    state: site?.state || customer?.state,
    zip: site?.zip || customer?.zip,
  };
  const directionsUrl = mapsDirectionsUrl(addressParts);
  const addressLine = formatAddress(addressParts) || 'No address';
  const showWalkthrough = Boolean(mods.ai_walkthrough);
  const showMedia = Boolean(mods.tech_media && allow('media'));
  const requireSignature = allow('customer_signature');
  const requireInvoice =
    Boolean(mods.invoices) &&
    (allow('send_invoice') || allow('record_payment'));
  const signatureData =
    (signatureRow?.signature_data as string | null | undefined) ?? null;
  const closeoutGaps = computeCloseoutGaps({
    checkOutAt: job.check_out_at,
    signatureData,
    signedAt: job.signed_at,
    total: Number(job.total) || 0,
    invoiceStatus: job.invoice_status,
    paymentStatus: job.payment_status,
    hasPhone: Boolean(customer?.phone),
    hasEmail: Boolean(customer?.email),
    requireSignature,
    requireInvoice,
  });
  const wrapStickyHint = closeoutStickyHint(closeoutGaps);

  const enableMessageDrafts = Boolean(
    mods.messaging && allow('messaging')
  );
  const draftContext = {
    techName: job.assigned_to_name || profile.full_name || null,
    customerName: job.customer_name || null,
    jobType: job.job_type || null,
    companyName: company.sms_signature || company.name || null,
    customerSummary: job.customer_summary || null,
  };

  const timePanel = allow('time_track') ? (
    <div id="finish-clock-out" tabIndex={-1} className="scroll-mt-36 outline-none">
      <TechCustomerDraftHost
        jobId={job.id}
        job={job}
        hasPhone={Boolean(customer?.phone)}
        draftContext={draftContext}
        enableDrafts={enableMessageDrafts}
        large
        offlineQueue={Boolean(mods.tech_offline_queue)}
      />
    </div>
  ) : null;

  const equipmentBlock = (
    <>
      {linkedEquipment && <WarrantyBadge info={linkedEquipment} />}
      {mods.equipment_timeline &&
        job.customer_id &&
        allow('manage_equipment') && (
          <JobPmChecklist
            customerId={job.customer_id}
            jobId={job.id}
            equipmentId={job.equipment_id}
            equipment={linkedEquipment}
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
      {job.customer_id && allow('manage_equipment') ? (
        <EquipmentSection
          customerId={job.customer_id}
          equipment={equipment ?? []}
          jobId={job.id}
          selectedEquipmentId={job.equipment_id}
        />
      ) : null}
    </>
  );

  const moreOnJob = (
    <>
      {mods.estimates && (
        <JobEstimatesPanel
          jobId={job.id}
          customerName={job.customer_name}
          estimates={jobEstimates}
          newHref={`/tech/jobs/${job.id}/estimate/new`}
          estimateHref={(estId) => `/tech/estimates/${estId}`}
          canCreate={canBuildEstimate}
          createLabel="Build estimate"
        />
      )}
      {mods.part_orders && allow('part_orders') && (
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
      {mods.inventory && allow('inventory_deduct') && (
        <TruckStockDeduct jobId={job.id} items={inventory ?? []} />
      )}
    </>
  );

  const header = (
    <div>
      <Link
        href="/tech"
        className="text-sm font-medium text-ink-500 hover:text-ink-800"
      >
        ← My jobs
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink-950">
          {job.customer_name || 'Job'}
        </h1>
        <LiveStatusBadge status={liveStatus} />
      </div>
      <p className="mt-1 text-sm text-ink-500">
        {job.job_number || id.slice(0, 8)} · {job.job_type || 'Job'}
        {job.priority ? ` · ${job.priority}` : ''}
        {job.scheduled_start
          ? ` · ${formatTimestamp(job.scheduled_start)}`
          : ''}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-700">
        <span>{addressLine}</span>
        {customer?.phone && (
          <a
            href={`tel:${customer.phone}`}
            className="font-semibold text-brand-700"
          >
            {customer.phone}
          </a>
        )}
        {directionsUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand-700 hover:underline"
          >
            Directions
          </a>
        )}
      </div>
    </div>
  );

  const arrive = (
    <>
      {mods.tech_offline_queue && (
        <OfflineSyncBanner jobId={job.id} enabled />
      )}
      {timePanel}
      <TechJobPacket packet={packet} compact hideCustomerBlock />
      {mods.messaging && allow('messaging') && (
        <JobMessageActions
          jobId={job.id}
          hasPhone={Boolean(customer?.phone)}
          large
        />
      )}
    </>
  );

  const work = (
    <>
      {showWalkthrough && (
        <JobWalkthroughPanel
          jobId={job.id}
          walkthrough={walkthrough}
          media={walkthroughMedia}
          canEdit={allow('edit_notes')}
          canMedia={allow('media')}
          allowTranscribe={Boolean(
            mods.ai && mods.ai_walkthrough && allow('edit_notes')
          )}
          allowGenerate={Boolean(
            mods.ai && mods.ai_walkthrough && allow('edit_notes')
          )}
          allowPdf={Boolean(mods.ai_walkthrough && mods.print_pdfs)}
          heroCapture
          readOnlyHint="Your role cannot edit notes — ask a dispatcher if you need changes saved."
        />
      )}

      {mods.tech_safety && allow('safety') && (
        <SafetyChecklist
          jobId={job.id}
          initial={(job.safety_checklist as SafetyChecklistState) || {}}
        />
      )}

      {allow('edit_notes') && (
        <TechJobNotes
          jobId={job.id}
          diagnosis={job.diagnosis}
          customerSummary={job.customer_summary}
          internalNotes={job.internal_notes}
          updatedAt={job.updated_at}
          offlineQueue={Boolean(mods.tech_offline_queue)}
        />
      )}

      {mods.ai && allow('ai_diagnostic') && (
        <TechCollapsibleSection
          title="Diagnostic assist"
          subtitle="Optional AI help from symptoms"
        >
          <DiagnosticAssist
            initialSymptoms={job.diagnosis || ''}
            equipmentType={linkedEquipment?.equipment_type}
            manufacturer={linkedEquipment?.manufacturer}
            model={linkedEquipment?.model}
            jobType={job.job_type}
          />
        </TechCollapsibleSection>
      )}

      {(linkedEquipment ||
        (job.customer_id && allow('manage_equipment'))) && (
        <TechCollapsibleSection
          title="Equipment"
          subtitle="Warranty, PM checklist, units"
        >
          <div className="space-y-4">{equipmentBlock}</div>
        </TechCollapsibleSection>
      )}

      {showMedia && (
        <TechCollapsibleSection
          title={showWalkthrough ? 'Extra photos' : 'Job photos & voice'}
          subtitle={
            showWalkthrough
              ? 'Optional extras — use Record walkthrough above first'
              : 'Photos, voice, customer approval'
          }
          defaultOpen={!showWalkthrough}
        >
          <JobMediaPanel
            jobId={job.id}
            attachments={attachments}
            customerApprovedAt={job.customer_approved_at}
            customerApprovedNote={job.customer_approved_note}
            allowVoiceTranscribe={Boolean(
              mods.ai && mods.tech_media && allow('edit_notes')
            )}
          />
        </TechCollapsibleSection>
      )}

      {(mods.estimates ||
        (mods.part_orders && allow('part_orders')) ||
        (mods.inventory && allow('inventory_deduct'))) && (
        <TechCollapsibleSection
          title="More on this job"
          subtitle="Estimates, parts orders, truck stock"
        >
          <div className="space-y-4">{moreOnJob}</div>
        </TechCollapsibleSection>
      )}
    </>
  );

  const wrap = (
    <>
      <FinishThisStopStrip gaps={closeoutGaps} />
      {timePanel}
      {allow('edit_notes') && (
        <TechJobNotes
          jobId={job.id}
          diagnosis={job.diagnosis}
          customerSummary={job.customer_summary}
          internalNotes={job.internal_notes}
          updatedAt={job.updated_at}
          offlineQueue={Boolean(mods.tech_offline_queue)}
        />
      )}
      {requireSignature && (
        <div id="finish-signature" tabIndex={-1} className="scroll-mt-36 outline-none">
          <SignaturePad
            jobId={job.id}
            existingName={job.signature_name}
            existingData={signatureData}
            signedAt={job.signed_at}
          />
        </div>
      )}
      {requireInvoice && (
        <div id="finish-invoice" tabIndex={-1} className="scroll-mt-36 outline-none">
          <JobInvoicePanel
            jobId={job.id}
            customerId={job.customer_id}
            total={Number(job.total) || 0}
            invoiceStatus={job.invoice_status}
            paymentStatus={job.payment_status}
            invoiceSentAt={job.invoice_sent_at}
            paymentMethod={job.payment_method}
            paymentLink={job.stripe_payment_link}
            hasPhone={Boolean(customer?.phone)}
            hasEmail={Boolean(customer?.email)}
            allowCashCheck={allow('record_payment')}
            allowSend={allow('send_invoice')}
            allowPdf={Boolean(mods.print_pdfs)}
          />
        </div>
      )}
      {mods.messaging && allow('messaging') && (
        <JobMessageLog messages={messages ?? []} />
      )}
    </>
  );

  return (
    <TechJobTicketShell
      liveStatus={liveStatus}
      header={header}
      arrive={arrive}
      work={work}
      wrapStickyHint={wrapStickyHint}
      wrap={wrap}
    />
  );
}
