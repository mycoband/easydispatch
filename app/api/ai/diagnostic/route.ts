import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assistDiagnosis } from '@/lib/grok';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

const bodySchema = z.object({
  symptoms: z.string().trim().min(3).max(4000),
  equipmentType: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  jobType: z.string().nullable().optional(),
});

/** POST /api/ai/diagnostic — field diagnostic assist */
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

    const assist = await assistDiagnosis(parsed.data);
    return NextResponse.json({ success: true, assist });
  } catch (error: unknown) {
    console.error('diagnostic assist error:', error);
    const message =
      error instanceof Error ? error.message : 'Diagnostic assist failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
