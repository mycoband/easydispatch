import { DispatchBoard } from '@/components/dispatch/DispatchBoard';
import { requireOffice } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import type { DispatchJob } from '@/lib/dispatch/types';
import { normalizeSkills } from '@/lib/hvac/skills';
import { formatAddress } from '@/lib/utils';
import { requireCompanyModule } from '@/lib/company/require-module';

export default async function DispatchPage() {
  await requireCompanyModule('dispatch');

  const [{ supabase }, company] = await Promise.all([
    requireOffice(),
    loadCompanySettings(),
  ]);
  const skillAware = Boolean(company.modules.skill_dispatch);
  const liveRealtime = Boolean(company.modules.dispatch_realtime);
  const capacityWarnings = Boolean(company.modules.capacity_warnings);

  const [{ data: jobs }, techsRes, { data: customers }, siteCoordsRes] =
    await Promise.all([
      supabase
        .from('jobs')
        .select(
          'id, job_number, customer_id, customer_name, job_type, status, priority, assigned_to, assigned_to_name, scheduled_start, scheduled_end, est_hours, internal_notes, drive_started_at, check_in_at, check_out_at, invoice_status, payment_status'
        )
        .neq('status', 'Cancelled')
        .order('scheduled_start', { ascending: true, nullsFirst: false })
        .limit(200),
      supabase
        .from('profiles')
        .select('id, full_name, role, skills, last_lat, last_lng')
        .eq('role', 'technician')
        .order('full_name', { ascending: true })
        .then(async (res) => {
          if (
            res.error &&
            /last_lat|last_lng|column|schema cache/i.test(res.error.message)
          ) {
            return supabase
              .from('profiles')
              .select('id, full_name, role, skills')
              .eq('role', 'technician')
              .order('full_name', { ascending: true });
          }
          return res;
        }),
      supabase
        .from('customers')
        .select('id, phone, address, city, state, zip'),
      // Latest check-in per customer for proximity ranking
      supabase
        .from('jobs')
        .select('customer_id, check_in_lat, check_in_lng, check_in_at')
        .not('check_in_lat', 'is', null)
        .not('check_in_lng', 'is', null)
        .order('check_in_at', { ascending: false })
        .limit(400),
    ]);

  const techs = techsRes.data;

  const customerById = new Map(
    (customers ?? []).map((c) => [
      c.id,
      {
        phone: c.phone,
        address: formatAddress(c),
      },
    ])
  );

  const siteByCustomer = new Map<string, { lat: number; lng: number }>();
  for (const row of siteCoordsRes.data ?? []) {
    if (!row.customer_id) continue;
    if (siteByCustomer.has(row.customer_id)) continue;
    const lat = Number(row.check_in_lat);
    const lng = Number(row.check_in_lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      siteByCustomer.set(row.customer_id, { lat, lng });
    }
  }

  const boardJobs: DispatchJob[] = (jobs ?? []).map((job) => {
    const cust = job.customer_id
      ? customerById.get(job.customer_id)
      : undefined;
    const site = job.customer_id
      ? siteByCustomer.get(job.customer_id)
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
      scheduled_end:
        (job as { scheduled_end?: string | null }).scheduled_end ?? null,
      est_hours: job.est_hours != null ? Number(job.est_hours) : null,
      internal_notes: job.internal_notes,
      drive_started_at: job.drive_started_at,
      check_in_at: job.check_in_at,
      check_out_at: job.check_out_at,
      invoice_status: job.invoice_status,
      payment_status: job.payment_status,
      phone: cust?.phone ?? null,
      address: cust?.address || null,
      site_lat: site?.lat ?? null,
      site_lng: site?.lng ?? null,
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
    ...(techs ?? []).map((t) => {
      const row = t as {
        id: string;
        full_name: string | null;
        skills?: unknown;
        last_lat?: number | null;
        last_lng?: number | null;
      };
      return {
        id: row.id,
        full_name: row.full_name,
        skills: normalizeSkills(row.skills),
        last_lat:
          row.last_lat != null && Number.isFinite(Number(row.last_lat))
            ? Number(row.last_lat)
            : null,
        last_lng:
          row.last_lng != null && Number.isFinite(Number(row.last_lng))
            ? Number(row.last_lng)
            : null,
      };
    }),
    ...extras.map((t) => ({
      ...t,
      skills: [] as string[],
      last_lat: null as number | null,
      last_lng: null as number | null,
    })),
  ];

  return (
    <DispatchBoard
      jobs={boardJobs}
      techs={boardTechs}
      skillAware={skillAware}
      liveRealtime={liveRealtime}
      capacityWarnings={capacityWarnings}
    />
  );
}
