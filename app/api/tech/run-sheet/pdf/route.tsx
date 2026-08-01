import { NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/auth';
import { localDateKey } from '@/lib/calendar/week';
import { loadCompanySettings } from '@/lib/company';
import { deriveLiveStatus } from '@/lib/jobs/time-tracking';
import { DaySheetDocument } from '@/lib/pdf/DaySheetDocument';
import { renderPdf } from '@/lib/pdf/render';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** Tech's printable run sheet for today (assigned jobs). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await ensureProfile(user);
  if (profile.role !== 'technician') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const company = await loadCompanySettings();
  if (!company.modules.print_pdfs) {
    return NextResponse.json(
      { error: 'Run sheet PDFs are disabled in Feature modules.' },
      { status: 403 }
    );
  }
  const dayKey = localDateKey(new Date());
  const dayStart = new Date(`${dayKey}T00:00:00`);
  const dayEnd = new Date(`${dayKey}T23:59:59.999`);

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select(
      'id, job_number, customer_name, job_type, status, scheduled_start, est_hours, drive_started_at, check_in_at, check_out_at, internal_notes, is_callback, warranty_flag'
    )
    .eq('assigned_to', user.id)
    .neq('status', 'Cancelled')
    .gte('scheduled_start', dayStart.toISOString())
    .lte('scheduled_start', dayEnd.toISOString())
    .order('scheduled_start', { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stops = (jobs ?? []).map((job) => {
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
  });

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
      title={`Run sheet — ${profile.full_name || 'Tech'}`}
      techBlocks={[
        {
          techName: profile.full_name || 'My route',
          stops,
        },
      ]}
    />
  );

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="run-sheet-${dayKey}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
