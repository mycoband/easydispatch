import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isOfficeRole, requireProfile } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import { extractPickTicketFromImage } from '@/lib/grok';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  jobId: z.string().uuid(),
  attachmentId: z.string().uuid(),
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
    if (!company.modules.part_orders) {
      return NextResponse.json(
        { error: 'Special-order parts are off' },
        { status: 403 }
      );
    }
    if (!company.modules.ai) {
      return NextResponse.json({ error: 'AI tools are off' }, { status: 403 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { profile } = await requireProfile();
    const { data: job } = await supabase
      .from('jobs')
      .select('id, assigned_to')
      .eq('id', parsed.data.jobId)
      .maybeSingle();
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (!isOfficeRole(profile.role) && job.assigned_to !== user.id) {
      return NextResponse.json({ error: 'Not assigned to this job' }, { status: 403 });
    }

    const { data: attachment, error: attErr } = await supabase
      .from('job_attachments')
      .select('id, job_id, kind, tag, url, extract_json')
      .eq('id', parsed.data.attachmentId)
      .eq('job_id', parsed.data.jobId)
      .maybeSingle();

    if (attErr && /extract_json/i.test(attErr.message)) {
      const retry = await supabase
        .from('job_attachments')
        .select('id, job_id, kind, tag, url')
        .eq('id', parsed.data.attachmentId)
        .eq('job_id', parsed.data.jobId)
        .maybeSingle();
      if (retry.error || !retry.data) {
        return NextResponse.json(
          { error: retry.error?.message || 'Attachment not found' },
          { status: 404 }
        );
      }
      return extractFromUrl(retry.data.url, parsed.data.attachmentId, false);
    }

    if (attErr || !attachment) {
      return NextResponse.json(
        { error: attErr?.message || 'Attachment not found' },
        { status: 404 }
      );
    }
    if (attachment.tag !== 'pick_ticket' || attachment.kind !== 'photo') {
      return NextResponse.json(
        { error: 'Not a pick ticket photo' },
        { status: 400 }
      );
    }
    if (!attachment.url) {
      return NextResponse.json({ error: 'Photo URL missing' }, { status: 400 });
    }

    return extractFromUrl(attachment.url, attachment.id, true);
  } catch (err) {
    console.error('pick-ticket', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Pick ticket extract failed',
      },
      { status: 500 }
    );
  }
}

async function extractFromUrl(
  url: string,
  attachmentId: string,
  persistExtract: boolean
) {
  const res = await fetch(url);
  if (!res.ok) {
    return NextResponse.json(
      { error: 'Could not download pick ticket image' },
      { status: 502 }
    );
  }
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    return NextResponse.json(
      { error: 'Attachment is not an image' },
      { status: 400 }
    );
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > 12 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image too large' }, { status: 400 });
  }

  const extract = await extractPickTicketFromImage(
    buffer.toString('base64'),
    contentType
  );

  if (persistExtract) {
    const admin = createServiceClient();
    const { error } = await admin
      .from('job_attachments')
      .update({ extract_json: extract })
      .eq('id', attachmentId);
    if (error && !/extract_json|column/i.test(error.message)) {
      console.warn('pick-ticket persist extract_json', error.message);
    } else if (error && /extract_json|column/i.test(error.message)) {
      console.warn(
        'Run supabase/pick-tickets.sql to persist pick ticket extracts'
      );
    }
  }

  return NextResponse.json({ extract });
}
