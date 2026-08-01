import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/admin';
import { loadCompanySettingsAdmin } from '@/lib/company';
import { CompanyBrandHeader } from '@/components/brand/CompanyBrandHeader';
import { ConfirmActions } from '@/components/confirm/ConfirmActions';
import { formatScheduleLabel } from '@/lib/messages/templates';

export default async function ConfirmAppointmentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-ink-600">
        Confirmation page unavailable — server config missing.
      </div>
    );
  }

  const { data: job } = await admin
    .from('jobs')
    .select(
      'id, customer_name, job_type, scheduled_start, confirmation_status, confirmed_at, reschedule_note'
    )
    .eq('confirmation_token', token)
    .maybeSingle();

  if (!job) notFound();

  const company = await loadCompanySettingsAdmin();

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-12">
      <CompanyBrandHeader
        company={company}
        eyebrow="Appointment confirmation"
        title={job.customer_name || 'Your appointment'}
        subtitle={`${job.job_type || 'Service'} · ${formatScheduleLabel(job.scheduled_start)}`}
      />

      <div className="panel p-5">
        <ConfirmActions
          token={token}
          initialStatus={job.confirmation_status}
          initialRescheduleNote={job.reschedule_note}
        />
      </div>

      <p className="text-center text-xs text-ink-400">{company.name}</p>
    </div>
  );
}
