import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fillTicketFromText } from '@/lib/grok';
import { HVAC_JOB_TYPES } from '@/lib/hvac/presets';
import { createClient } from '@/lib/supabase/server';
import { ensureProfile, isOfficeRole } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';

export const maxDuration = 60;

const bodySchema = z.object({
  text: z.string().trim().min(8).max(8000),
  customerNames: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
});

/** POST /api/ai/ticket-fill — natural language → structured job fields */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await ensureProfile(user);
    if (!isOfficeRole(profile.role)) {
      return NextResponse.json({ error: 'Office only' }, { status: 403 });
    }

    const company = await loadCompanySettings();
    if (!company.modules.ai) {
      return NextResponse.json(
        { error: 'AI module is turned off in Settings' },
        { status: 403 }
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

    const fill = await fillTicketFromText({
      text: parsed.data.text,
      customerNames: parsed.data.customerNames,
      jobTypeOptions: [...HVAC_JOB_TYPES],
    });

    return NextResponse.json({ success: true, fill });
  } catch (error: unknown) {
    console.error('ticket-fill error:', error);
    const message =
      error instanceof Error ? error.message : 'Ticket fill failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
