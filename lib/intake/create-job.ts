import { createServiceClient } from '@/lib/supabase/admin';
import { allocateNextJobNumber } from '@/lib/jobs/numbers';
import { normalizePhone } from '@/lib/twilio';
import type { IntakeChannel, IntakeExtract } from '@/lib/intake/types';

const DEDUPE_HOURS = 6;

export type CreateIntakeJobResult = {
  jobId: string;
  customerId: string;
  created: boolean;
  merged: boolean;
};

/**
 * Find or create customer + undated New job from AI intake extract.
 * Dedupes open intake jobs for the same phone within a short window.
 */
export async function createJobFromIntake(opts: {
  companyId: string;
  channel: IntakeChannel;
  extract: IntakeExtract;
  transcript: string;
  externalId?: string | null;
}): Promise<CreateIntakeJobResult> {
  const admin = createServiceClient();
  const phone = normalizePhone(opts.extract.phone) || normalizePhone(
    opts.extract.phone || ''
  );
  const fromPhone =
    phone ||
    (opts.extract.phone?.trim() ? opts.extract.phone.trim() : null);

  if (fromPhone) {
    const since = new Date(
      Date.now() - DEDUPE_HOURS * 60 * 60 * 1000
    ).toISOString();
    const { data: existing } = await admin
      .from('jobs')
      .select('id, customer_id, diagnosis, internal_notes')
      .eq('company_id', opts.companyId)
      .eq('intake_source', opts.channel)
      .is('scheduled_start', null)
      .neq('status', 'Cancelled')
      .neq('status', 'Completed')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(8);

    for (const job of existing ?? []) {
      const { data: cust } = await admin
        .from('customers')
        .select('id, phone')
        .eq('id', job.customer_id)
        .maybeSingle();
      const custPhone = normalizePhone(cust?.phone);
      if (custPhone && custPhone === fromPhone) {
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
            intake_external_id: opts.externalId || null,
            internal_notes: mergedNotes.slice(0, 10000),
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
        return {
          jobId: job.id,
          customerId: job.customer_id as string,
          created: false,
          merged: true,
        };
      }
    }
  }

  let customerId: string | null = null;
  if (fromPhone) {
    const { data: byPhone } = await admin
      .from('customers')
      .select('id')
      .eq('company_id', opts.companyId)
      .eq('phone', fromPhone)
      .limit(1)
      .maybeSingle();
    customerId = byPhone?.id ?? null;
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
    if (opts.extract.address) patch.address = opts.extract.address;
    if (opts.extract.city) patch.city = opts.extract.city;
    if (opts.extract.state) patch.state = opts.extract.state;
    if (opts.extract.zip) patch.zip = opts.extract.zip;
    if (opts.extract.email) patch.email = opts.extract.email;
    if (Object.keys(patch).length) {
      await admin.from('customers').update(patch).eq('id', customerId);
    }
  }

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
      intake_external_id: opts.externalId || null,
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
