import Link from 'next/link';
import { GbbPackageBuilder } from '@/components/estimates/GbbPackageBuilder';
import { requireOffice } from '@/lib/auth';
import { loadPricebookPresets } from '@/lib/pricebook/load';
import { requireCompanyModule } from '@/lib/company/require-module';

export default async function GbbEstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  await requireCompanyModule('gbb');

  const { supabase } = await requireOffice();
  const { customerId } = await searchParams;

  const [{ data: customers }, { data: taxRates }, presets] = await Promise.all([
    supabase.from('customers').select('id, name').order('name'),
    supabase.from('tax_rates').select('id, name, rate').order('name'),
    loadPricebookPresets(supabase),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          href="/dashboard/estimates"
          className="text-sm font-medium text-ink-500 hover:text-ink-800"
        >
          ← Estimates
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink-950">
          Good / Better / Best package
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Build three pricing options for one job — the customer picks their
          favorite on the portal.
        </p>
      </div>

      {(customers ?? []).length === 0 ? (
        <div className="panel p-6 text-sm text-ink-600">
          Add a customer first.{' '}
          <Link
            href="/dashboard/customers/new"
            className="font-medium text-brand-700"
          >
            New customer
          </Link>
        </div>
      ) : (
        <GbbPackageBuilder
          customers={customers ?? []}
          taxRates={taxRates ?? []}
          initialCustomerId={customerId}
          presets={presets}
        />
      )}
    </div>
  );
}
