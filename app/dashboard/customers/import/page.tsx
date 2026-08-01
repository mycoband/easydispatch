import Link from 'next/link';
import { requireOffice } from '@/lib/auth';
import { CustomerImportPanel } from '@/components/customers/CustomerImportPanel';

export default async function CustomerImportPage() {
  await requireOffice();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard/customers"
          className="text-sm font-medium text-ink-500 hover:text-ink-800"
        >
          ← Customers
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink-950">
          Import customers
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Bring over your existing customer list when switching to EasyDispatch.
        </p>
      </div>

      <CustomerImportPanel />
    </div>
  );
}
