import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile, isOfficeRole } from '@/lib/auth';
import { localDateKey } from '@/lib/calendar/week';
import { loadCompanySettings } from '@/lib/company';
import { deriveLiveStatus } from '@/lib/jobs/time-tracking';
import { DaySheetDocument } from '@/lib/pdf/DaySheetDocument';
import { renderPdf } from '@/lib/pdf/render';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await ensureProfile(user);
  if (!isOfficeRole(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const company = await loadCompanySettings();
  if (!company.modules.day_sheet || !company.modules.print_pdfs) {
    return NextResponse.json(
      { error: 'Day sheet PDFs are disabled in Feature modules.' },
      { status: 403 }
    );
  }
  const dateParam = req.nextUrl.searchParams.get('date')?.trim() || '';
  const dayKey =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : localDateKey(new Date());

  const dayStart = new Date(`${dayKey}T00:00:00`);
  const dayEnd = new Date(`${dayKey}T23:59:59.999`);

  const [{ data: techs }, { data: jobs }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'technician')
      .order('full_name'),
    supabase
      .from('jobs')
      .select(
        'id, job_number, customer_name, job_type, status, assigned_to, assigned_to_name, scheduled_start, est_hours, drive_started_at, check_in_at, check_out_at, internal_notes, is_callback, warranty_flag'
      )
      .neq('status', 'Cancelled')
      .gte('scheduled_start', dayStart.toISOString())
      .lte('scheduled_start', dayEnd.toISOString())
      .order('scheduled_start', { ascending: true }),
  ]);

  const byTech = new Map<string, typeof jobs>();
  const unassignedKey = 'unassigned';
  byTech.set(unassignedKey, []);
  for (const t of techs ?? []) byTech.set(t.id, []);

  for (const job of jobs ?? []) {
    const key = job.assigned_to || unassignedKey;
    if (!byTech.has(key)) byTech.set(key, []);
    byTech.get(key)!.push(job);
  }

  const techName = (id: string) => {
    if (id === unassignedKey) return 'Unassigned';
    return (techs ?? []).find((t) => t.id === id)?.full_name || 'Tech';
  };

  const toStop = (job: NonNullable<typeof jobs>[number]) => {
    const live = deriveLiveStatus(job);
    const flags = [
      job.is_callback ? 'Callback' : '',
      job.warranty_flag ? 'Warranty' : '',
    ]
      .filter(Boolean)
      .join(' · ');
    return {
      time: job.scheduled_start
        ? new Date(job.scheduled_start).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })
        : '',
      customer: job.customer_name || 'Customer',
      jobNumber: job.job_number || '',
      jobType: job.job_type || 'Job',
      hours: job.est_hours != null ? `${job.est_hours}h` : '',
      notes: (job.internal_notes || '').replace(/\s+/g, ' ').slice(0, 120),
      flags,
      status: live || job.status || '',
    };
  };

  const techBlocks = [...byTech.entries()]
    .filter(([, list]) => (list ?? []).length > 0)
    .map(([id, list]) => ({
      techName: techName(id),
      stops: (list ?? []).map(toStop),
    }));

  // Include empty techs with no work so huddle shows capacity? Skip empties for brevity.
  const dateLabel = dayStart.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const bytes = await renderPdf(
    <DaySheetDocument
      companyName={company.name}
      dateLabel={dateLabel}
      techBlocks={techBlocks}
      title="Day sheet"
    />
  );

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="day-sheet-${dayKey}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
