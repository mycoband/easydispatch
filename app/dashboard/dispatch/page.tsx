import { DispatchBoard } from '@/components/dispatch/DispatchBoard';
import { requireOffice } from '@/lib/auth';
import type { DispatchJob } from '@/lib/dispatch/types';
import { formatAddress } from '@/lib/utils';
import { requireCompanyModule } from '@/lib/company/require-module';

export default async function DispatchPage() {
  await requireCompanyModule('dispatch');

  const { supabase } = await requireOffice();

  const [{ data: jobs }, { data: techs }, { data: customers }] =
    await Promise.all([
      supabase
        .from('jobs')
        .select(
          'id, job_number, customer_id, customer_name, job_type, status, priority, assigned_to, assigned_to_name, scheduled_start, est_hours, internal_notes, drive_started_at, check_in_at, check_out_at, invoice_status, payment_status'
        )
        .neq('status', 'Cancelled')
        .order('scheduled_start', { ascending: true, nullsFirst: false })
        .limit(200),
      supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('role', 'technician')
        .order('full_name', { ascending: true }),
      supabase
        .from('customers')
        .select('id, phone, address, city, state, zip'),
    ]);

  const customerById = new Map(
    (customers ?? []).map((c) => [
      c.id,
      {
        phone: c.phone,
        address: formatAddress(c),
      },
    ])
  );

  const boardJobs: DispatchJob[] = (jobs ?? []).map((job) => {
    const cust = job.customer_id
      ? customerById.get(job.customer_id)
      : undefined;
    return {
      id: job.id,
      job_number: job.job_number,
      customer_id: job.customer_id,
      customer_name: job.customer_name,
      job_type: job.job_type,
      status: job.status,
      priority: job.priority,
      assigned_to: job.assigned_to,
      assigned_to_name: job.assigned_to_name,
      scheduled_start: job.scheduled_start,
      est_hours: job.est_hours != null ? Number(job.est_hours) : null,
      internal_notes: job.internal_notes,
      drive_started_at: job.drive_started_at,
      check_in_at: job.check_in_at,
      check_out_at: job.check_out_at,
      invoice_status: job.invoice_status,
      payment_status: job.payment_status,
      phone: cust?.phone ?? null,
      address: cust?.address || null,
    };
  });

  // Include techs who have assigned jobs even if role isn’t technician
  const techIds = new Set((techs ?? []).map((t) => t.id));
  const extras = boardJobs
    .filter((j) => j.assigned_to && !techIds.has(j.assigned_to))
    .reduce<{ id: string; full_name: string | null }[]>((acc, j) => {
      if (!j.assigned_to || acc.some((t) => t.id === j.assigned_to)) return acc;
      acc.push({
        id: j.assigned_to,
        full_name: j.assigned_to_name,
      });
      return acc;
    }, []);

  const boardTechs = [
    ...(techs ?? []).map((t) => ({
      id: t.id,
      full_name: t.full_name,
    })),
    ...extras,
  ];

  return <DispatchBoard jobs={boardJobs} techs={boardTechs} />;
}
