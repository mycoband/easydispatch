import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { lookupFilterSpecs } from '@/lib/grok';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

const bodySchema = z.object({
  manufacturer: z.string().nullable().optional(),
  model_number: z.string().nullable().optional(),
  serial_number: z.string().nullable().optional(),
  equipment_type: z.string().nullable().optional(),
  /** fast = model knowledge (default, quick). web = agentic web search (slow). */
  mode: z.enum(['fast', 'web']).optional(),
});

/**
 * POST /api/ai/lookup-filters
 * Looks up filter size/qty from manufacturer + model (+ serial).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid body' },
        { status: 400 }
      );
    }

    const filterLookup = await lookupFilterSpecs(parsed.data, {
      mode: parsed.data.mode || 'fast',
    });

    return NextResponse.json({ success: true, filterLookup });
  } catch (error: unknown) {
    console.error('lookup-filters error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to look up filters';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
