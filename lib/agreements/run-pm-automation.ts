import { createServiceClient } from '@/lib/supabase/admin';
import { createPmJobForAgreement } from '@/lib/agreements/create-pm-job';

export type PmAutomationResult = {
  created: number;
  skipped: number;
  errors: string[];
};

/** Create PM jobs for active agreements due today or earlier (pm_automation on). */
export async function runPmJobAutomation(): Promise<PmAutomationResult> {
  const admin = createServiceClient();
  const errors: string[] = [];
  let created = 0;
  let skipped = 0;

  const today = new Date().toISOString().slice(0, 10);

  const { data: settingsRows, error: settingsErr } = await admin
    .from('company_settings')
    .select('company_id, modules');

  if (settingsErr) {
    return { created: 0, skipped: 0, errors: [settingsErr.message] };
  }

  const enabledCompanies = new Set<string>();
  for (const row of settingsRows ?? []) {
    const modules =
      row.modules && typeof row.modules === 'object'
        ? (row.modules as Record<string, boolean>)
        : {};
    // Missing key → default false for pm_automation
    if (modules.pm_automation === true && row.company_id) {
      enabledCompanies.add(row.company_id);
    }
  }

  if (enabledCompanies.size === 0) {
    return { created: 0, skipped: 0, errors: [] };
  }

  const { data: due, error: dueErr } = await admin
    .from('service_agreements')
    .select(
      'id, company_id, customer_id, customer_name, plan_name, visits_per_year, next_due_date, notes, status'
    )
    .eq('status', 'Active')
    .lte('next_due_date', today)
    .limit(200);

  if (dueErr) {
    return { created: 0, skipped: 0, errors: [dueErr.message] };
  }

  for (const agreement of due ?? []) {
    if (!agreement.company_id || !enabledCompanies.has(agreement.company_id)) {
      skipped++;
      continue;
    }
    // Also require agreements module not explicitly off
    const settings = (settingsRows ?? []).find(
      (s) => s.company_id === agreement.company_id
    );
    const modules =
      settings?.modules && typeof settings.modules === 'object'
        ? (settings.modules as Record<string, boolean>)
        : {};
    if (modules.agreements === false) {
      skipped++;
      continue;
    }

    const result = await createPmJobForAgreement(admin, agreement, {
      companyId: agreement.company_id,
      createdBy: null,
    });
    if (result.error && !result.jobId) {
      errors.push(`${agreement.plan_name}: ${result.error}`);
    } else {
      created++;
    }
  }

  return { created, skipped, errors };
}
