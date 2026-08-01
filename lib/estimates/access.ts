import { requireProfile } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import { roleHasPermission } from '@/lib/company/permissions';
import { isOfficeRole } from '@/lib/roles';

export type EstimateActor = Awaited<ReturnType<typeof requireProfile>> & {
  isOffice: boolean;
};

export async function getEstimateActor(): Promise<EstimateActor> {
  const ctx = await requireProfile();
  return { ...ctx, isOffice: isOfficeRole(ctx.profile.role) };
}

type JobRow = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  job_number: string | null;
  assigned_to: string | null;
  company_id: string | null;
};

export async function loadJobForEstimate(
  supabase: EstimateActor['supabase'],
  jobId: string
): Promise<JobRow | null> {
  const { data } = await supabase
    .from('jobs')
    .select('id, customer_id, customer_name, job_number, assigned_to, company_id')
    .eq('id', jobId)
    .maybeSingle();
  return data;
}

/** Office always; tech only if assigned + manage_estimates permission. */
export async function assertCanBuildEstimateOnJob(
  actor: EstimateActor,
  job: JobRow
): Promise<string | null> {
  if (actor.profile.company_id && job.company_id && job.company_id !== actor.profile.company_id) {
    return 'Job belongs to another company';
  }
  if (actor.isOffice) return null;

  if (job.assigned_to !== actor.user.id) {
    return 'You are not assigned to this job';
  }

  const company = await loadCompanySettings();
  if (!company.modules.estimates) {
    return 'Estimates are disabled for this company';
  }
  if (!roleHasPermission(actor.profile.role, 'manage_estimates', company.role_permissions)) {
    return 'You do not have permission to build estimates';
  }
  return null;
}

export async function assertCanEditEstimate(
  actor: EstimateActor,
  estimate: {
    id: string;
    job_id?: string | null;
    company_id?: string | null;
  }
): Promise<string | null> {
  if (
    actor.profile.company_id &&
    estimate.company_id &&
    estimate.company_id !== actor.profile.company_id
  ) {
    return 'Estimate belongs to another company';
  }
  if (actor.isOffice) return null;

  if (!estimate.job_id) {
    return 'Technicians can only edit estimates linked to their job';
  }

  const job = await loadJobForEstimate(actor.supabase, estimate.job_id);
  if (!job) return 'Linked job not found';
  return assertCanBuildEstimateOnJob(actor, job);
}
