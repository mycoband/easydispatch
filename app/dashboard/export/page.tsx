import { ExportPanel } from '@/components/export/ExportPanel';
import { requireOffice } from '@/lib/auth';
import { loadCompanySettings, companyHasModule } from '@/lib/company';
import { requireCompanyModuleAndPermission } from '@/lib/company/require-module';

export default async function ExportPage() {
  await requireCompanyModuleAndPermission('export', 'view_reports');
  await requireOffice();
  const company = await loadCompanySettings();
  const jobCostingEnabled = companyHasModule(company, 'job_costing');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-950">
          Export
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          QuickBooks-friendly CSV exports for your bookkeeper or accountant.
        </p>
      </div>

      <ExportPanel jobCostingEnabled={jobCostingEnabled} />
    </div>
  );
}
