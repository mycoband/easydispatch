import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadJobAssistantContext } from '@/lib/ai/job-assistant-context';
import { loadCompanySettings } from '@/lib/company';
import { jobOfficeAssistant } from '@/lib/grok';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  jobId: z.string().uuid(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(20),
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
    if (!company.modules.ai) {
      return NextResponse.json({ error: 'AI tools are off' }, { status: 403 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const last = parsed.data.messages[parsed.data.messages.length - 1];
    if (!last || last.role !== 'user') {
      return NextResponse.json(
        { error: 'Last message must be from the user' },
        { status: 400 }
      );
    }

    const loaded = await loadJobAssistantContext(
      supabase,
      parsed.data.jobId,
      company.company_id
    );
    if ('error' in loaded) {
      return NextResponse.json({ error: loaded.error }, { status: 404 });
    }

    const answer = await jobOfficeAssistant(
      parsed.data.messages,
      loaded.context
    );

    return NextResponse.json({ answer });
  } catch (err) {
    console.error('job-assistant', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Job assistant failed',
      },
      { status: 500 }
    );
  }
}
