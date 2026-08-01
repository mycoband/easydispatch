import {
  JobCalendar,
  type CalendarJob,
} from '@/components/calendar/JobCalendar';
import { UnscheduledJobs } from '@/components/calendar/UnscheduledJobs';
import { requireOffice } from '@/lib/auth';
import { requireCompanyModule } from '@/lib/company/require-module';
import {
  type CalendarView,
  localDateKey,
  monthGridDays,
  monthOffsetForDateKey,
  monthStartFromOffset,
  weekDays,
  weekOffsetForDateKey,
  weekStartFromOffset,
} from '@/lib/calendar/week';

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    week?: string;
    month?: string;
    date?: string;
  }>;
}) {
  await requireCompanyModule('calendar');

  const { supabase } = await requireOffice();
  const { view: viewParam, week, month, date } = await searchParams;

  const view: CalendarView = viewParam === 'week' ? 'week' : 'month';

  let weekOffset = Number.parseInt(week || '0', 10) || 0;
  let monthOffset = Number.parseInt(month || '0', 10) || 0;

  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    if (view === 'week' && week == null) {
      weekOffset = weekOffsetForDateKey(date);
    }
    if (view === 'month' && month == null) {
      monthOffset = monthOffsetForDateKey(date);
    }
  }

  const days =
    view === 'month'
      ? monthGridDays(monthStartFromOffset(monthOffset))
      : weekDays(weekStartFromOffset(weekOffset));

  const rangeStart = days[0];
  const rangeEnd = new Date(days[days.length - 1]);
  rangeEnd.setHours(23, 59, 59, 999);

  const [{ data: jobs }, { data: nearby }, { data: unscheduled }] =
    await Promise.all([
      supabase
        .from('jobs')
        .select(
          'id, job_number, customer_name, job_type, priority, assigned_to_name, scheduled_start, status'
        )
        .neq('status', 'Cancelled')
        .not('scheduled_start', 'is', null)
        .gte('scheduled_start', rangeStart.toISOString())
        .lte('scheduled_start', rangeEnd.toISOString())
        .order('scheduled_start', { ascending: true }),
      supabase
        .from('jobs')
        .select(
          'id, job_number, customer_name, job_type, priority, assigned_to_name, scheduled_start, status'
        )
        .neq('status', 'Cancelled')
        .not('scheduled_start', 'is', null)
        .gte(
          'scheduled_start',
          new Date(rangeStart.getTime() - 24 * 60 * 60 * 1000).toISOString()
        )
        .lte(
          'scheduled_start',
          new Date(rangeEnd.getTime() + 24 * 60 * 60 * 1000).toISOString()
        ),
      supabase
        .from('jobs')
        .select('id, job_number, customer_name, job_type, priority, status')
        .neq('status', 'Cancelled')
        .neq('status', 'Completed')
        .is('scheduled_start', null)
        .order('created_at', { ascending: false })
        .limit(12),
    ]);

  const dayKeys = new Set(days.map((d) => localDateKey(d)));
  const merged = new Map<string, CalendarJob>();
  for (const job of [...(jobs ?? []), ...(nearby ?? [])]) {
    if (!job.scheduled_start) continue;
    const key = localDateKey(new Date(job.scheduled_start));
    if (dayKeys.has(key)) merged.set(job.id, job);
  }

  return (
    <div className="space-y-5">
      <JobCalendar
        view={view}
        weekOffset={weekOffset}
        monthOffset={monthOffset}
        jobs={Array.from(merged.values())}
        highlightDate={date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null}
      />
      <UnscheduledJobs jobs={unscheduled ?? []} />
    </div>
  );
}
