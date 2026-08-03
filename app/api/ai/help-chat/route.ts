import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertAiRateLimit } from '@/lib/ai/rate-limit';
import { loadCompanySettings } from '@/lib/company';
import { createClient } from '@/lib/supabase/server';
import { helpChat } from '@/lib/grok';
import { faqPromptBlock } from '@/lib/help/faq';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
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

    const limited = await assertAiRateLimit(user.id, 'help-chat');
    if (!limited.ok) {
      return NextResponse.json(
        { error: limited.error },
        {
          status: 429,
          headers: { 'Retry-After': String(limited.retryAfterSec) },
        }
      );
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const last = parsed.data.messages[parsed.data.messages.length - 1];
    if (last.role !== 'user') {
      return NextResponse.json(
        { error: 'Last message must be from the user' },
        { status: 400 }
      );
    }

    const reply = await helpChat(parsed.data.messages, faqPromptBlock());
    return NextResponse.json({ reply });
  } catch (err) {
    console.error('help-chat error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Help chat failed' },
      { status: 500 }
    );
  }
}
