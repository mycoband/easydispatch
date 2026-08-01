import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { loadCompanySettings } from '@/lib/company';
import { callGrok } from '@/lib/grok';

export const runtime = 'nodejs';
export const maxDuration = 45;

const bodySchema = z.object({
  costing: z.object({
    revenue: z.number(),
    material_cost: z.number(),
    labor_cost: z.number(),
    overhead_cost: z.number(),
    total_cost: z.number(),
    gross_profit: z.number(),
    margin_pct: z.number().nullable(),
    below_target: z.boolean(),
    target_margin_pct: z.number(),
    flags: z.array(z.string()),
  }),
  context: z.string().max(2000).optional(),
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
    if (!company.modules.job_costing) {
      return NextResponse.json(
        { error: 'Job costing is turned off for this company' },
        { status: 403 }
      );
    }
    if (!company.modules.ai) {
      return NextResponse.json(
        { error: 'AI tools are turned off for this company' },
        { status: 403 }
      );
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const c = parsed.data.costing;
    const advice = await callGrok(
      [
        {
          role: 'system',
          content: `You are an HVAC service business margin coach for EasyDispatch.
Give concise, actionable advice (under 160 words) to improve job profitability.
Use bullets. Focus on pricing, billed labor hours, parts markup, trip fees, and flat-rate packages.
Do not invent exact vendor prices. If costs look missing, say so.
Company target margin: ${c.target_margin_pct}%.`,
        },
        {
          role: 'user',
          content: `Job P&L:
Sold (pre-tax): $${c.revenue}
Materials: $${c.material_cost}
Labor: $${c.labor_cost}
Overhead: $${c.overhead_cost}
Total cost: $${c.total_cost}
Gross profit: $${c.gross_profit}
Margin: ${c.margin_pct ?? 'n/a'}%
Below target: ${c.below_target}
Flags: ${c.flags.join(', ') || 'none'}
${parsed.data.context ? `Context: ${parsed.data.context}` : ''}`,
        },
      ],
      { temperature: 0.3 }
    );

    return NextResponse.json({ advice: advice.trim() });
  } catch (err) {
    console.error('margin-coach', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Coach failed' },
      { status: 500 }
    );
  }
}
