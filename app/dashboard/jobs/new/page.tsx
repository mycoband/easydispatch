import Link from 'next/link';
import { createJob } from '@/app/dashboard/jobs/actions';
import { JobFormWithAi } from '@/components/jobs/JobFormWithAi';
import { requireOffice } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import { defaultScheduleIsoForDate } from '@/lib/calendar/week';
import { loadJobFormOptions } from '@/lib/jobs/form-data';
import { allocateNextJobNumber } from '@/lib/jobs/numbers';

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{
    customerId?: string;
    propertyId?: string;
    equipmentId?: string;
    date?: string;
    callback?: string;
  }>;
}) {
  const { supabase, profile } = await requireOffice();
  const { customerId, propertyId, equipmentId, date, callback } =
    await searchParams;
  const isCallback =
    callback === '1' || callback === 'true' || callback === 'yes';
  const [options, company, suggestedJobNumber] = await Promise.all([
    loadJobFormOptions(supabase, { customerId: customerId || null }),
    loadCompanySettings(),
    allocateNextJobNumber(supabase, profile.company_id),
  ]);

  const scheduledFromDate =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? defaultScheduleIsoForDate(date, 9)
      : null;

  const prefilledCustomer = options.customers[0] || null;
  const backHref = customerId
    ? `/dashboard/customers/${customerId}`
    : date
      ? '/dashboard/calendar'
      : '/dashboard/jobs';
  const backLabel = customerId
    ? '← Customer'
    : date
      ? '← Calendar'
      : '← Jobs';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={backHref}
          className="text-sm font-medium text-ink-500 hover:text-ink-800"
        >
          {backLabel}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink-950">
          {isCallback
            ? 'Schedule revisit'
            : date
              ? 'Schedule job'
              : 'New job'}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {isCallback
            ? `Callback / revisit${prefilledCustomer ? ` for ${prefilledCustomer.name}` : ''} — flagged as callback and ready to schedule.`
            : prefilledCustomer
              ? `For ${prefilledCustomer.name}${propertyId ? ' · site selected' : ''}. You can change the customer anytime.`
              : date
                ? `Pre-filled for ${date} at 9:00 AM — change time as needed.`
                : company.modules.ai
                  ? 'Search for a customer, or paste call notes for AI fill.'
                  : 'Search and pick a customer, then fill out the ticket.'}
        </p>
      </div>

      <div className="panel p-5 sm:p-6">
        <JobFormWithAi
          action={createJob}
          customers={options.customers}
          equipmentByCustomer={options.equipmentByCustomer}
          propertiesByCustomer={options.propertiesByCustomer}
          techs={options.techs}
          taxRates={options.taxRates}
          enableAi={Boolean(company.modules.ai)}
          suggestedJobNumber={suggestedJobNumber}
          initial={{
            customer_id: customerId || undefined,
            customer_name: prefilledCustomer?.name || undefined,
            property_id: propertyId || undefined,
            job_number: suggestedJobNumber,
            equipment_id: equipmentId || '',
            job_type: isCallback ? 'Callback' : undefined,
            priority: isCallback ? 'High' : 'Medium',
            status: scheduledFromDate || isCallback ? 'Scheduled' : 'New',
            tax_rate_id: 'kcmo-jackson',
            scheduled_start: scheduledFromDate,
            is_callback: isCallback || undefined,
          }}
          submitLabel={
            isCallback ? 'Create revisit' : date ? 'Schedule job' : 'Create job'
          }
        />
      </div>
    </div>
  );
}
