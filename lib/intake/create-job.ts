import { createServiceClient } from '@/lib/supabase/admin';
import { allocateNextJobNumber } from '@/lib/jobs/numbers';
import { normalizePhone } from '@/lib/twilio';
import type { IntakeChannel, IntakeExtract } from '@/lib/intake/types';

export type CreateIntakeJobResult = {
  jobId: string;
  customerId: string;
  created: boolean;
  merged: boolean;
};

function digitsPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  if (d.length === 10) return d;
  return d.length >= 10 ? d.slice(-10) : null;
}

/** Same open intake job only when clearly the same request (webhook retry or continuation). */
function isRelatedIntake(opts: {
  existingDiagnosis: string | null | undefined;
  existingSummary: string | null | undefined;
  existingAddress: string | null | undefined;
  extract: IntakeExtract;
}): boolean {
  const norm = (s: string | null | undefined) =>
    (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const addrA = norm(opts.existingAddress);
  const addrB = norm(opts.extract.address);
  if (addrA && addrB && addrA === addrB) {
    const diagA = norm(opts.existingDiagnosis);
    const diagB = norm(opts.extract.diagnosis);
    if (diagA && diagB) {
      // Same address + overlapping problem text → treat as update, not a second job
      if (diagA.includes(diagB) || diagB.includes(diagA)) return true;
      const wordsA = new Set(diagA.split(' ').filter((w) => w.length > 3));
      const wordsB = diagB.split(' ').filter((w) => w.length > 3);
      const overlap = wordsB.filter((w) => wordsA.has(w)).length;
      if (wordsB.length > 0 && overlap / wordsB.length >= 0.5) return true;
    }
  }

  const sumA = norm(opts.existingSummary);
  const sumB = norm(opts.extract.summary);
  if (sumA && sumB && (sumA.includes(sumB) || sumB.includes(sumA))) return true;

  return false;
}

/**
 * Find or create customer by phone, then create an undated New job.
 *
 * Rules:
 * - Existing customer (same company + phone) → reuse that customer
 * - New phone → create customer (+ primary property)
 * - Each call/SMS completion → new job by default
 * - Merge/update only when:
 *   1) same intake_external_id (Twilio/Vapi retry), or
 *   2) same customer has an open undated intake job that is clearly the same request
 */
export async function createJobFromIntake(opts: {
  companyId: string;
  channel: IntakeChannel;
  extract: IntakeExtract;
  transcript: string;
  externalId?: string | null;
}): Promise<CreateIntakeJobResult> {
  const admin = createServiceClient();
  const fromPhone =
    normalizePhone(opts.extract.phone) ||
    (opts.extract.phone?.trim() ? opts.extract.phone.trim() : null);
  const externalId = opts.externalId?.trim() || null;

  // 1) Idempotent retry: same Twilio MessageSid / Vapi call id
  if (externalId) {
    const { data: byExt } = await admin
      .from('jobs')
      .select('id, customer_id')
      .eq('company_id', opts.companyId)
      .eq('intake_external_id', externalId)
      .limit(1)
      .maybeSingle();
    if (byExt?.id && byExt.customer_id) {
      await admin
        .from('jobs')
        .update({
          diagnosis: opts.extract.diagnosis,
          customer_summary: opts.extract.customer_summary,
          priority: opts.extract.priority,
          job_type: opts.extract.job_type,
          intake_summary: opts.extract.summary,
          intake_transcript: opts.transcript.slice(0, 20000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', byExt.id);
      return {
        jobId: byExt.id,
        customerId: byExt.customer_id as string,
        created: false,
        merged: true,
      };
    }
  }

  // 2) Resolve customer by phone (reuse account)
  let customerId: string | null = null;
  let customerAddress: string | null = null;

  if (fromPhone) {
    const last10 = digitsPhone(fromPhone);
    let match: { id: string; phone: string | null; address: string | null } | null =
      null;

    const { data: exact } = await admin
      .from('customers')
      .select('id, phone, address')
      .eq('company_id', opts.companyId)
      .eq('phone', fromPhone)
      .limit(1)
      .maybeSingle();
    if (exact) match = exact;

    if (!match && last10) {
      const { data: candidates } = await admin
        .from('customers')
        .select('id, phone, address')
        .eq('company_id', opts.companyId)
        .ilike('phone', `%${last10}%`)
        .limit(25);
      match =
        (candidates ?? []).find(
          (c) => normalizePhone(c.phone) === fromPhone || digitsPhone(c.phone) === last10
        ) ?? null;
    }

    if (match) {
      customerId = match.id;
      customerAddress = match.address;
    }
  }

  const name =
    opts.extract.customer_name.trim() ||
    (fromPhone ? `Caller ${fromPhone}` : 'New caller');

  if (!customerId) {
    const { data: customer, error: custErr } = await admin
      .from('customers')
      .insert({
        company_id: opts.companyId,
        name,
        phone: fromPhone,
        email: opts.extract.email,
        address: opts.extract.address,
        city: opts.extract.city,
        state: opts.extract.state,
        zip: opts.extract.zip,
      })
      .select('id')
      .single();
    if (custErr || !customer) {
      throw new Error(custErr?.message || 'Could not create customer');
    }
    customerId = customer.id;
    customerAddress = opts.extract.address;
    await admin.from('properties').insert({
      company_id: opts.companyId,
      customer_id: customerId,
      name: 'Primary',
      address: opts.extract.address,
      city: opts.extract.city,
      state: opts.extract.state || 'MO',
      zip: opts.extract.zip,
      access_notes: opts.extract.access_notes,
      is_primary: true,
    });
  } else {
    const patch: Record<string, string> = {};
    if (name && !name.startsWith('Caller ')) patch.name = name;
    if (opts.extract.address) {
      patch.address = opts.extract.address;
      customerAddress = opts.extract.address;
    }
    if (opts.extract.city) patch.city = opts.extract.city;
    if (opts.extract.state) patch.state = opts.extract.state;
    if (opts.extract.zip) patch.zip = opts.extract.zip;
    if (opts.extract.email) patch.email = opts.extract.email;
    if (fromPhone) patch.phone = fromPhone;
    if (Object.keys(patch).length) {
      await admin.from('customers').update(patch).eq('id', customerId);
    }
  }

  // 3) Related open intake for this customer only (same problem) → update, else new job
  const { data: openIntake } = await admin
    .from('jobs')
    .select(
      'id, customer_id, diagnosis, intake_summary, internal_notes, status'
    )
    .eq('company_id', opts.companyId)
    .eq('customer_id', customerId)
    .not('intake_source', 'is', null)
    .is('scheduled_start', null)
    .neq('status', 'Cancelled')
    .neq('status', 'Completed')
    .order('created_at', { ascending: false })
    .limit(5);

  for (const job of openIntake ?? []) {
    if (
      isRelatedIntake({
        existingDiagnosis: job.diagnosis,
        existingSummary: job.intake_summary,
        existingAddress: customerAddress || opts.extract.address,
        extract: opts.extract,
      })
    ) {
      const mergedNotes = [
        job.internal_notes || '',
        opts.extract.access_notes
          ? `Access: ${opts.extract.access_notes}`
          : '',
        `Updated via AI receptionist (${opts.channel})`,
      ]
        .filter(Boolean)
        .join('\n');
      await admin
        .from('jobs')
        .update({
          diagnosis: opts.extract.diagnosis || job.diagnosis,
          customer_summary: opts.extract.customer_summary,
          priority: opts.extract.priority,
          job_type: opts.extract.job_type,
          intake_summary: opts.extract.summary,
          intake_transcript: opts.transcript.slice(0, 20000),
          intake_external_id: externalId || null,
          internal_notes: mergedNotes.slice(0, 10000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      return {
        jobId: job.id,
        customerId: customerId!,
        created: false,
        merged: true,
      };
    }
  }

  // 4) New job for this call
  const jobNumber = await allocateNextJobNumber(admin, opts.companyId);
  const internal = [
    opts.extract.access_notes
      ? `Access: ${opts.extract.access_notes}`
      : null,
    `Created by AI receptionist (${opts.channel === 'ai_sms' ? 'SMS' : 'phone'}). Schedule on Calendar or Dispatch.`,
  ]
    .filter(Boolean)
    .join('\n');

  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .insert({
      company_id: opts.companyId,
      job_number: jobNumber,
      customer_id: customerId,
      customer_name: name,
      job_type: opts.extract.job_type || 'Service call',
      priority: opts.extract.priority || 'Medium',
      status: 'New',
      diagnosis: opts.extract.diagnosis,
      customer_summary: opts.extract.customer_summary,
      scheduled_start: null,
      assigned_to: null,
      assigned_to_name: null,
      internal_notes: internal,
      intake_source: opts.channel,
      intake_summary: opts.extract.summary,
      intake_transcript: opts.transcript.slice(0, 20000),
      intake_external_id: externalId,
      tax_rate_id: 'kcmo-jackson',
    })
    .select('id')
    .single();

  if (jobErr || !job) {
    throw new Error(jobErr?.message || 'Could not create intake job');
  }

  return {
    jobId: job.id,
    customerId: customerId!,
    created: true,
    merged: false,
  };
}
