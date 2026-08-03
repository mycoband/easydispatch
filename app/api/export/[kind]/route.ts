import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile, isOfficeRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { csvResponse, qbDate, toCsv } from '@/lib/export/csv';
import { EXPORT_KINDS, type ExportKind } from '@/lib/export/kinds';
import {
  buildTimesheetRows,
  TIMESHEET_CSV_HEADERS,
  timesheetRowsToCsvValues,
  weekStartIsoForDate,
  type TimesheetJobRow,
} from '@/lib/export/timesheets';

function monthStartDateStr() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function rangeFromParams(searchParams: URLSearchParams) {
  const from = searchParams.get('from')?.trim() || monthStartDateStr();
  const to = searchParams.get('to')?.trim() || todayDateStr();
  const fromIso = `${from}T00:00:00.000Z`;
  const toIso = `${to}T23:59:59.999Z`;
  return { from, to, fromIso, toIso };
}

/** GET /api/export/[kind]?from=YYYY-MM-DD&to=YYYY-MM-DD — QuickBooks-friendly CSV exports. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ kind: string }> }
) {
  const { kind } = await params;

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

  if (!EXPORT_KINDS.includes(kind as ExportKind)) {
    return NextResponse.json({ error: 'Unknown export kind' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const { from, to, fromIso, toIso } = rangeFromParams(searchParams);

  try {
    if (kind === 'paid') {
      const { data, error } = await supabase
        .from('jobs')
        .select(
          'job_number, customer_name, subtotal, tax_amount, total, payment_method, payment_status, invoice_sent_at, created_at'
        )
        .eq('payment_status', 'Paid')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: true });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const csv = toCsv(
        [
          'Date',
          'Job Number',
          'Customer',
          'Amount',
          'Tax',
          'Total',
          'Payment Method',
          'Payment Status',
        ],
        (data ?? []).map((j) => [
          qbDate(j.invoice_sent_at || j.created_at),
          j.job_number || '',
          j.customer_name || '',
          (Number(j.subtotal) || 0).toFixed(2),
          (Number(j.tax_amount) || 0).toFixed(2),
          (Number(j.total) || 0).toFixed(2),
          j.payment_method || '',
          j.payment_status || '',
        ])
      );

      return csvResponse(`paid-invoices-${from}-to-${to}.csv`, csv);
    }

    if (kind === 'unpaid') {
      const { data, error } = await supabase
        .from('jobs')
        .select(
          'job_number, customer_name, subtotal, tax_amount, total, payment_status, invoice_sent_at, created_at'
        )
        .eq('invoice_status', 'Sent')
        .neq('payment_status', 'Paid')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: true });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const csv = toCsv(
        [
          'Date',
          'Job Number',
          'Customer',
          'Amount',
          'Tax',
          'Total',
          'Payment Status',
        ],
        (data ?? []).map((j) => [
          qbDate(j.invoice_sent_at || j.created_at),
          j.job_number || '',
          j.customer_name || '',
          (Number(j.subtotal) || 0).toFixed(2),
          (Number(j.tax_amount) || 0).toFixed(2),
          (Number(j.total) || 0).toFixed(2),
          j.payment_status || '',
        ])
      );

      return csvResponse(`unpaid-ar-${from}-to-${to}.csv`, csv);
    }

    if (kind === 'job_costing') {
      const { data, error } = await supabase
        .from('jobs')
        .select(
          'job_number, customer_name, job_type, status, payment_status, assigned_to_name, created_at, actual_hours, subtotal, total, cost_materials, cost_labor, cost_overhead, cost_total, gross_profit, margin_pct'
        )
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .neq('status', 'Cancelled')
        .order('created_at', { ascending: true });

      if (error) {
        return NextResponse.json(
          {
            error: /cost_total|gross_profit|column/i.test(error.message)
              ? 'Run supabase/job-costing.sql first, then export again.'
              : error.message,
          },
          { status: 500 }
        );
      }

      const csv = toCsv(
        [
          'Date',
          'Job Number',
          'Customer',
          'Job Type',
          'Status',
          'Tech',
          'Hours',
          'Sold (pre-tax)',
          'Invoice Total',
          'Materials Cost',
          'Labor Cost',
          'Overhead Cost',
          'Total Cost',
          'Gross Profit',
          'Margin %',
          'Payment Status',
        ],
        (data ?? []).map((j) => [
          qbDate(j.created_at),
          j.job_number || '',
          j.customer_name || '',
          j.job_type || '',
          j.status || '',
          j.assigned_to_name || '',
          (Number(j.actual_hours) || 0).toFixed(2),
          (Number(j.subtotal) || 0).toFixed(2),
          (Number(j.total) || 0).toFixed(2),
          (Number(j.cost_materials) || 0).toFixed(2),
          (Number(j.cost_labor) || 0).toFixed(2),
          (Number(j.cost_overhead) || 0).toFixed(2),
          (Number(j.cost_total) || 0).toFixed(2),
          (Number(j.gross_profit) || 0).toFixed(2),
          j.margin_pct != null ? Number(j.margin_pct).toFixed(2) : '',
          j.payment_status || '',
        ])
      );

      return csvResponse(`job-costing-${from}-to-${to}.csv`, csv);
    }

    if (kind === 'tech_pnl') {
      const { data, error } = await supabase
        .from('jobs')
        .select(
          'assigned_to, assigned_to_name, actual_hours, subtotal, total, cost_total, gross_profit, payment_status, status'
        )
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .neq('status', 'Cancelled');

      if (error) {
        return NextResponse.json(
          {
            error: /cost_total|gross_profit|column/i.test(error.message)
              ? 'Run supabase/job-costing.sql first, then export again.'
              : error.message,
          },
          { status: 500 }
        );
      }

      type Agg = {
        name: string;
        jobs: number;
        completed: number;
        hours: number;
        sold: number;
        cost: number;
        profit: number;
        paid: number;
      };
      const map = new Map<string, Agg>();
      for (const j of data ?? []) {
        const key = j.assigned_to || 'unassigned';
        const row = map.get(key) || {
          name: j.assigned_to_name || 'Unassigned',
          jobs: 0,
          completed: 0,
          hours: 0,
          sold: 0,
          cost: 0,
          profit: 0,
          paid: 0,
        };
        row.jobs += 1;
        if (j.status === 'Completed') row.completed += 1;
        row.hours += Number(j.actual_hours) || 0;
        row.sold += Number(j.subtotal) || Number(j.total) || 0;
        row.cost += Number(j.cost_total) || 0;
        row.profit += Number(j.gross_profit) || 0;
        if (j.payment_status === 'Paid') {
          row.paid += Number(j.total) || 0;
        }
        map.set(key, row);
      }

      const rows = [...map.values()].sort((a, b) => b.profit - a.profit);
      const csv = toCsv(
        [
          'Tech',
          'Jobs',
          'Completed',
          'Hours',
          'Sold (pre-tax)',
          'Total Cost',
          'Gross Profit',
          'Margin %',
          'Paid Revenue',
        ],
        rows.map((r) => [
          r.name,
          String(r.jobs),
          String(r.completed),
          r.hours.toFixed(2),
          r.sold.toFixed(2),
          r.cost.toFixed(2),
          r.profit.toFixed(2),
          r.sold > 0 ? ((r.profit / r.sold) * 100).toFixed(2) : '',
          r.paid.toFixed(2),
        ])
      );

      return csvResponse(`tech-pnl-${from}-to-${to}.csv`, csv);
    }

    if (kind === 'timesheets') {
      // Pull from start of the workweek containing `from` so weekly OT is correct
      const weekFromIso = weekStartIsoForDate(from);
      const { data, error } = await supabase
        .from('jobs')
        .select(
          'assigned_to, assigned_to_name, job_number, customer_name, job_type, status, check_in_at, check_out_at, actual_hours, drive_started_at'
        )
        .not('check_out_at', 'is', null)
        .gte('check_out_at', weekFromIso)
        .lte('check_out_at', toIso)
        .neq('status', 'Cancelled')
        .order('check_out_at', { ascending: true });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const jobs = (data ?? []) as TimesheetJobRow[];
      const techIds = [
        ...new Set(
          jobs.map((j) => j.assigned_to).filter((id): id is string => Boolean(id))
        ),
      ];

      const ratesByTechId = new Map<string, number>();
      if (techIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, hourly_cost')
          .in('id', techIds);
        for (const p of profiles ?? []) {
          const rate = Number(p.hourly_cost) || 0;
          if (rate > 0) ratesByTechId.set(p.id, rate);
        }
      }

      const fromMs = new Date(fromIso).getTime();
      const toMs = new Date(toIso).getTime();
      const rows = buildTimesheetRows(jobs, ratesByTechId, (checkOut) => {
        const t = new Date(checkOut).getTime();
        return t >= fromMs && t <= toMs;
      });

      const csv = toCsv(
        [...TIMESHEET_CSV_HEADERS],
        timesheetRowsToCsvValues(rows)
      );

      return csvResponse(`timesheets-${from}-to-${to}.csv`, csv);
    }

    // customers
    const { data, error } = await supabase
      .from('customers')
      .select('name, phone, email, address, city, state, zip')
      .order('name', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const csv = toCsv(
      ['Name', 'Phone', 'Email', 'Address', 'City', 'State', 'Zip'],
      (data ?? []).map((c) => [
        c.name || '',
        c.phone || '',
        c.email || '',
        c.address || '',
        c.city || '',
        c.state || '',
        c.zip || '',
      ])
    );

    return csvResponse('customers.csv', csv);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 }
    );
  }
}
