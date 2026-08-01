import Link from 'next/link';
import { createCustomer } from '@/app/dashboard/customers/actions';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { requireOffice } from '@/lib/auth';

export default async function NewCustomerPage() {
  await requireOffice();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/customers"
          className="text-sm font-medium text-ink-500 hover:text-ink-800"
        >
          ← Customers
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink-950">
          New customer
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Create a property record, then add equipment on the profile.
        </p>
      </div>

      <div className="panel p-5 sm:p-6">
        <CustomerForm action={createCustomer} submitLabel="Create customer" />
      </div>
    </div>
  );
}
