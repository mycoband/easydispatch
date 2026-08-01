import { createServiceClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { normalizeCosting } from '@/lib/jobs/costing';
import { formatMoney } from '@/lib/jobs/totals';

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  const diff = day === 0 ? 6 : day - 1; // Monday start
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export type DigestResult = {
  sent: number;
  skipped: number;
  errors: string[];
};

/** Send weekly profit digests to companies with job costing + digest enabled. */
export async function sendWeeklyProfitDigests(): Promise<DigestResult> {
  const admin = createServiceClient();
  const errors: string[] = [];
  let sent = 0;
  let skipped = 0;

  const weekStart = startOfWeek();
  // Previous full Mon–Sun for “last week”
  const prevEnd = new Date(weekStart);
  prevEnd.setMilliseconds(-1);
  const prevStart = startOfWeek(prevEnd);

  const fromIso = prevStart.toISOString();
  const toIso = prevEnd.toISOString();
  const label = `${prevStart.toISOString().slice(0, 10)} → ${prevEnd.toISOString().slice(0, 10)}`;

  const { data: settingsRows, error: settingsErr } = await admin
    .from('company_settings')
    .select('company_id, name, email, modules, costing');

  if (settingsErr) {
    return { sent: 0, skipped: 0, errors: [settingsErr.message] };
  }

  for (const row of settingsRows ?? []) {
    const modules =
      row.modules && typeof row.modules === 'object'
        ? (row.modules as Record<string, boolean>)
        : {};
    if (!modules.job_costing) {
      skipped++;
      continue;
    }
    const costing = normalizeCosting(row.costing);
    if (!costing.weekly_digest_enabled) {
      skipped++;
      continue;
    }

    const to =
      costing.weekly_digest_email?.trim() ||
      (typeof row.email === 'string' ? row.email.trim() : '');
    if (!to || !to.includes('@')) {
      skipped++;
      continue;
    }

    if (!row.company_id) {
      skipped++;
      continue;
    }

    const { data: jobs, error: jobsErr } = await admin
      .from('jobs')
      .select(
        'job_number, customer_name, job_type, assigned_to_name, subtotal, cost_total, gross_profit, margin_pct, status'
      )
      .eq('company_id', row.company_id)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .neq('status', 'Cancelled');

    if (jobsErr) {
      errors.push(`${row.name}: ${jobsErr.message}`);
      continue;
    }

    const list = jobs ?? [];
    const sold = list.reduce(
      (s, j) => s + (Number(j.subtotal) || 0),
      0
    );
    const cost = list.reduce(
      (s, j) => s + (Number(j.cost_total) || 0),
      0
    );
    const profit = list.reduce(
      (s, j) => s + (Number(j.gross_profit) || 0),
      0
    );
    const margin = sold > 0 ? (profit / sold) * 100 : null;
    const below = list.filter(
      (j) =>
        j.margin_pct != null &&
        Number(j.margin_pct) < costing.target_margin_pct
    ).length;

    const worst = [...list]
      .sort(
        (a, b) =>
          (Number(a.gross_profit) || 0) - (Number(b.gross_profit) || 0)
      )
      .slice(0, 5);

    const byTech = new Map<string, { profit: number; jobs: number }>();
    for (const j of list) {
      const name = j.assigned_to_name || 'Unassigned';
      const rowT = byTech.get(name) || { profit: 0, jobs: 0 };
      rowT.profit += Number(j.gross_profit) || 0;
      rowT.jobs += 1;
      byTech.set(name, rowT);
    }
    const techLines = [...byTech.entries()]
      .sort((a, b) => b[1].profit - a[1].profit)
      .slice(0, 8)
      .map(
        ([name, t]) =>
          `  • ${name}: ${formatMoney(t.profit)} profit (${t.jobs} jobs)`
      )
      .join('\n');

    const worstLines = worst
      .map(
        (j) =>
          `  • ${j.customer_name || 'Customer'} / ${j.job_type || 'Job'}: ${formatMoney(Number(j.gross_profit) || 0)} (${j.margin_pct != null ? `${Number(j.margin_pct).toFixed(0)}%` : 'n/a'})`
      )
      .join('\n');

    const companyName = row.name || 'EasyDispatch';
    const subject = `${companyName} weekly profit — ${label}`;
    const text = `${companyName} — weekly job costing digest
Period: ${label}

Jobs: ${list.length}
Sold (pre-tax): ${formatMoney(sold)}
Total cost: ${formatMoney(cost)}
Gross profit: ${formatMoney(profit)}
Avg margin: ${margin == null ? 'n/a' : `${margin.toFixed(1)}%`}
Below ${costing.target_margin_pct}% target: ${below}

Profit by tech:
${techLines || '  (none)'}

Lowest profit jobs:
${worstLines || '  (none)'}

Open Reports in EasyDispatch for details and CSV export.
`;

    const result = await sendEmail({ to, subject, text });
    if (!result.ok) {
      errors.push(`${companyName} → ${to}: ${result.error || 'send failed'}`);
    } else {
      sent++;
    }
  }

  return { sent, skipped, errors };
}
