import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateWalkthroughReportAction } from '@/app/tech/walkthrough-actions';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 300;

const bodySchema = z.object({
  jobId: z.string().uuid(),
  notes: z.string().max(20000).optional(),
});

/** POST /api/ai/walkthrough — generate structured walkthrough report via Grok */
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

    const result = await generateWalkthroughReportAction(parsed.data.jobId, {
      notes: parsed.data.notes,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.success || 'Report generated',
    });
  } catch (error: unknown) {
    console.error('walkthrough generate error:', error);
    const message =
      error instanceof Error ? error.message : 'Walkthrough generate failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
