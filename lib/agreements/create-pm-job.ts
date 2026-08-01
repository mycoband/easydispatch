import { allocateNextJobNumber } from '@/lib/jobs/numbers';

export function advanceDueDate(from: string | null, visitsPerYear: number) {
  const base = from ? new Date(`${from}T12:00:00`) : new Date();
  const days = Math.max(1, Math.round(365 / Math.max(1, visitsPerYear)));
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

type AgreementRow = {
  id: string;
  company_id?: string | null;
  customer_id: string;
  customer_name: string | null;
  plan_name: string;
  visits_per_year: number | null;
  next_due_date: string | null;
  notes: string | null;
};

/** Create a scheduled PM job and advance agreement next_due_date. */
export async function createPmJobForAgreement(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  agreement: AgreementRow,
  opts: { createdBy?: string | null; companyId?: string | null }
): Promise<{ jobId?: string; error?: string }> {
  const companyId = opts.companyId || agreement.company_id || null;
  const due =
    agreement.next_due_date || new Date().toISOString().slice(0, 10);
  const scheduled = new Date(`${due}T09:00:00`).toISOString();
  const jobNumber = await allocateNextJobNumber(supabase, companyId);

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      company_id: companyId,
      job_number: jobNumber,
      customer_id: agreement.customer_id,
      customer_name: agreement.customer_name,
      job_type: 'Maintenance / PM',
      priority: 'Medium',
      status: 'Scheduled',
      diagnosis: `PM from agreement: ${agreement.plan_name}`,
      scheduled_start: scheduled,
      est_hours: 1.5,
      internal_notes: agreement.notes
        ? `${agreement.notes}\n(Auto-created from agreement)`
        : 'Auto-created from service agreement',
      created_by: opts.createdBy || null,
      tax_rate_id: 'kcmo-jackson',
    })
    .select('id')
    .single();

  if (jobError || !job) {
    return { error: jobError?.message || 'Could not create PM job' };
  }

  const nextDue = advanceDueDate(
    due,
    Number(agreement.visits_per_year) || 4
  );

  const { error: updErr } = await supabase
    .from('service_agreements')
    .update({
      next_due_date: nextDue,
      last_pm_job_id: job.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agreement.id);

  if (updErr) {
    return { jobId: job.id, error: updErr.message };
  }

  return { jobId: job.id };
}
