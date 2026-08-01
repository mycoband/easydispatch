import type { DispatchJob } from '@/lib/dispatch/types';

/** Merge a Supabase postgres_changes payload into a DispatchJob card. */
export function mergeRealtimeJob(
  prev: DispatchJob | undefined,
  row: Record<string, unknown>
): DispatchJob | null {
  if (row.status === 'Cancelled') return null;

  const id = String(row.id || prev?.id || '');
  if (!id) return null;

  const numOrNull = (v: unknown) =>
    v == null || v === ''
      ? null
      : Number.isFinite(Number(v))
        ? Number(v)
        : null;

  return {
    id,
    job_number:
      (row.job_number as string | null | undefined) ?? prev?.job_number ?? null,
    customer_id:
      (row.customer_id as string | null | undefined) ??
      prev?.customer_id ??
      null,
    customer_name:
      (row.customer_name as string | null | undefined) ??
      prev?.customer_name ??
      null,
    job_type:
      (row.job_type as string | null | undefined) ?? prev?.job_type ?? null,
    status: (row.status as string | null | undefined) ?? prev?.status ?? null,
    priority:
      (row.priority as string | null | undefined) ?? prev?.priority ?? null,
    assigned_to:
      (row.assigned_to as string | null | undefined) ??
      prev?.assigned_to ??
      null,
    assigned_to_name:
      (row.assigned_to_name as string | null | undefined) ??
      prev?.assigned_to_name ??
      null,
    scheduled_start:
      (row.scheduled_start as string | null | undefined) ??
      prev?.scheduled_start ??
      null,
    scheduled_end:
      (row.scheduled_end as string | null | undefined) ??
      prev?.scheduled_end ??
      null,
    est_hours:
      row.est_hours !== undefined
        ? numOrNull(row.est_hours)
        : (prev?.est_hours ?? null),
    internal_notes:
      (row.internal_notes as string | null | undefined) ??
      prev?.internal_notes ??
      null,
    drive_started_at:
      (row.drive_started_at as string | null | undefined) ??
      prev?.drive_started_at ??
      null,
    check_in_at:
      (row.check_in_at as string | null | undefined) ??
      prev?.check_in_at ??
      null,
    check_out_at:
      (row.check_out_at as string | null | undefined) ??
      prev?.check_out_at ??
      null,
    invoice_status:
      (row.invoice_status as string | null | undefined) ??
      prev?.invoice_status ??
      null,
    payment_status:
      (row.payment_status as string | null | undefined) ??
      prev?.payment_status ??
      null,
    phone: prev?.phone ?? null,
    address: prev?.address ?? null,
    site_lat: prev?.site_lat ?? null,
    site_lng: prev?.site_lng ?? null,
  };
}
