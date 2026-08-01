import Link from 'next/link';
import { requireOffice } from '@/lib/auth';
import { requireCompanyModuleAndPermission } from '@/lib/company/require-module';
import { PricebookImportPanel } from '@/components/pricebook/PricebookImportPanel';

export default async function PricebookImportPage() {
  await requireCompanyModuleAndPermission('pricebook', 'manage_pricebook');
  await requireOffice();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard/pricebook"
          className="text-sm font-medium text-ink-500 hover:text-ink-800"
        >
          ← Pricebook
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink-950">
          Import pricebook
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Bring over flat rates when switching to EasyDispatch.
        </p>
      </div>
      <PricebookImportPanel />
    </div>
  );
}
