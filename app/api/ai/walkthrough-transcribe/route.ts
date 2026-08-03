import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { transcribeWalkthroughVoice } from '@/app/tech/walkthrough-actions';
import { assertAiRateLimit } from '@/lib/ai/rate-limit';
import { createClient } from '@/lib/supabase/server';

/** Whisper on walkthrough voice/video can take a while on phone clips. */
export const maxDuration = 300;

const bodySchema = z.object({
  jobId: z.string().uuid(),
  attachmentId: z.string().uuid(),
});

/** POST /api/ai/walkthrough-transcribe — Whisper → walkthrough notes */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await assertAiRateLimit(user.id, 'walkthrough-transcribe');
    if (!limited.ok) {
      return NextResponse.json(
        { error: limited.error },
        {
          status: 429,
          headers: { 'Retry-After': String(limited.retryAfterSec) },
        }
      );
    }

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid body' },
        { status: 400 }
      );
    }

    const result = await transcribeWalkthroughVoice(
      parsed.data.jobId,
      parsed.data.attachmentId
    );

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.success || 'Transcribed',
    });
  } catch (error: unknown) {
    console.error('walkthrough transcribe error:', error);
    const message =
      error instanceof Error ? error.message : 'Transcription failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
