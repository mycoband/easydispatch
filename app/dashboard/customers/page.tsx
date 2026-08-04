import Link from 'next/link';
import { requireOffice } from '@/lib/auth';
import { formatAddress } from '@/lib/utils';

const PAGE_SIZE = 100;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { supabase, profile } = await requireOffice();
  const { q, page: pageRaw } = await searchParams;
  const query = q?.trim() || '';
  const page = Math.max(1, Number.parseInt(pageRaw || '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let request = supabase
    .from('customers')
    .select('id, name, address, city, state, zip, phone, email', {
      count: 'exact',
    })
    .order('name', { ascending: true })
    .range(from, to);

  if (profile.company_id) {
    request = request.eq('company_id', profile.company_id);
  }

  if (query) {
    const safe = query.replace(/[%_,]/g, '');
    request = request.or(
      `name.ilike.%${safe}%,address.ilike.%${safe}%,city.ilike.%${safe}%,phone.ilike.%${safe}%`
    );
  }

  const { data: customers, error, count } = await request;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (p > 1) params.set('page', String(p));
    const s = params.toString();
    return s ? `/dashboard/customers?${s}` : '/dashboard/customers';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Customers
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {total.toLocaleString()}{' '}
            {total === 1 ? 'customer' : 'customers'}
            {query ? ' matching your search' : ''}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/customers/import"
            className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            Import CSV
          </Link>
          <Link
            href="/dashboard/customers/new"
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            New customer
          </Link>
        </div>
      </div>

      <form className="panel flex flex-wrap gap-2 p-3">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search name, address, phone…"
          className="min-w-[220px] flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-4"
        />
        <button
          type="submit"
          className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
        >
          Search
        </button>
        {query && (
          <Link
            href="/dashboard/customers"
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-500 hover:text-ink-800"
          >
            Clear
          </Link>
        )}
      </form>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.message}
        </p>
      )}

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-ink-50/80 text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Address
              </th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">
                Phone
              </th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {(customers ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-ink-500">
                  {query
                    ? 'No customers match that search.'
                    : 'No customers yet. Import a CSV or create your first record.'}
                </td>
              </tr>
            ) : (
              (customers ?? []).map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-ink-100 last:border-0 hover:bg-ink-50/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/customers/${customer.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {customer.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-500 md:hidden">
                      {formatAddress(customer) || '—'}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500 lg:hidden">
                      {customer.phone || 'No phone'}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 text-ink-600 md:table-cell">
                    {formatAddress(customer) || '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-ink-600 lg:table-cell">
                    {customer.phone || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/customers/${customer.id}`}
                      className="inline-flex min-h-11 items-center text-sm font-medium text-brand-700 hover:text-brand-800"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-ink-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={qs(page - 1)}
                className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 font-medium text-ink-700 hover:bg-ink-50"
              >
                Previous
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={qs(page + 1)}
                className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 font-medium text-ink-700 hover:bg-ink-50"
              >
                Next
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
