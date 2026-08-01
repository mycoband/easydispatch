import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { loadCompanySettings } from '@/lib/company';
import { callGrok } from '@/lib/grok';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  question: z.string().min(3).max(500),
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const company = await loadCompanySettings();
    if (!company.modules.reports) {
      return NextResponse.json({ error: 'Reports are off' }, { status: 403 });
    }
    if (!company.modules.ai) {
      return NextResponse.json({ error: 'AI tools are off' }, { status: 403 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const from = parsed.data.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const to = parsed.data.to || new Date().toISOString();

    let q = supabase
      .from('jobs')
      .select(
        'id, job_number, customer_name, job_type, status, payment_status, total, subtotal, actual_hours, assigned_to_name, cost_total, gross_profit, margin_pct, created_at'
      )
      .gte('created_at', from)
      .lte('created_at', to)
      .neq('status', 'Cancelled')
      .order('created_at', { ascending: false })
      .limit(80);

    if (company.company_id) {
      q = q.eq('company_id', company.company_id);
    }

    const { data: jobs, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const summary = (jobs ?? []).map((j) => ({
      job: j.job_number || j.id.slice(0, 8),
      customer: j.customer_name,
      type: j.job_type,
      status: j.status,
      paid: j.payment_status,
      sold: j.subtotal ?? j.total,
      cost: j.cost_total,
      profit: j.gross_profit,
      margin: j.margin_pct,
      hours: j.actual_hours,
      tech: j.assigned_to_name,
    }));

    const totals = summary.reduce(
      (acc, j) => {
        acc.sold += Number(j.sold) || 0;
        acc.cost += Number(j.cost) || 0;
        acc.profit += Number(j.profit) || 0;
        return acc;
      },
      { sold: 0, cost: 0, profit: 0 }
    );

    const answer = await callGrok(
      [
        {
          role: 'system',
          content: `You are EasyDispatch Reports AI for an HVAC company.
Answer using ONLY the job stats provided. Be concise (under 200 words). Use bullets and numbers.
If job costing fields are null, say costs may not be calculated yet (run job-costing SQL / save line items).
Never invent jobs not in the data.`,
        },
        {
          role: 'user',
          content: `Period ${from} → ${to}
Aggregate: sold $${totals.sold.toFixed(2)}, cost $${totals.cost.toFixed(2)}, profit $${totals.profit.toFixed(2)}, jobs ${summary.length}
Job costing module: ${company.modules.job_costing ? 'on' : 'off'}

Data (JSON):
${JSON.stringify(summary)}

Question: ${parsed.data.question}`,
        },
      ],
      { temperature: 0.2 }
    );

    return NextResponse.json({ answer: answer.trim() });
  } catch (err) {
    console.error('ask-reports', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ask reports failed' },
      { status: 500 }
    );
  }
}
