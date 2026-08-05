import { NextResponse } from 'next/server';
import { extractIntakeConversation } from '@/lib/grok';
import { escalateToHuman } from '@/lib/intake/escalate';
import { mapGrokIntake } from '@/lib/intake/map-extract';
import { processReadyIntake } from '@/lib/intake/process';
import { intakeRateLimit } from '@/lib/intake/rate-limit';
import { resolveCompanyForInboundDid } from '@/lib/intake/resolve-company';
import {
  resolveVapiFromPhone,
  resolveVapiToPhone,
} from '@/lib/intake/vapi-phone';
import { createServiceClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * Vapi server URL / end-of-call webhook.
 * Configure assistant to POST here with transcript + customer phone.
 * Optional header: x-vapi-secret = VAPI_WEBHOOK_SECRET
 */
export async function POST(request: Request) {
  const secret = process.env.VAPI_WEBHOOK_SECRET?.trim();
  if (secret) {
    const hdr =
      request.headers.get('x-vapi-secret') ||
      request.headers.get('x-easydispatch-vapi-secret');
    if (hdr !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const message = (payload.message || payload) as Record<string, unknown>;
  const type = String(message.type || payload.type || '');

  // Only process end-of-call reports (and rare payloads that already include a transcript).
  // Assign an assistantId on the Vapi phone number — do not rely on assistant-request here.
  const isEndOfCall = /end-of-call-report|end-of-call|endOfCall|call\.ended/i.test(
    type
  );
  if (
    type &&
    !isEndOfCall &&
    !message.transcript &&
    !(message.artifact as { transcript?: string } | undefined)?.transcript
  ) {
    return NextResponse.json({ ok: true, ignored: true, type });
  }

  const artifact = (message.artifact || {}) as Record<string, unknown>;
  const call = (message.call || payload.call || {}) as Record<string, unknown>;

  const transcript = String(
    artifact.transcript ||
      message.transcript ||
      payload.transcript ||
      ''
  ).trim();

  const fromPhone = resolveVapiFromPhone(call, message);
  const toResolved = resolveVapiToPhone(call, message, payload);

  if (!transcript || transcript.length < 20) {
    console.warn('vapi skip short_transcript', {
      type,
      len: transcript.length,
      to: toResolved,
    });
    return NextResponse.json({ ok: true, skipped: 'short_transcript' });
  }

  const rl = intakeRateLimit({
    key: `voice:${fromPhone || 'unknown'}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const ctx = await resolveCompanyForInboundDid(toResolved);
  if (!ctx || !ctx.modules.ai_receptionist || !ctx.modules.ai) {
    console.warn('vapi company/module miss', {
      to: toResolved,
      companyId: ctx?.companyId ?? null,
      ai: ctx?.modules.ai ?? null,
      ai_receptionist: ctx?.modules.ai_receptionist ?? null,
    });
    return NextResponse.json(
      {
        ok: false,
        error: ctx ? 'module_off' : 'unknown_did',
        to: toResolved,
      },
      { status: 200 }
    );
  }

  const admin = createServiceClient();
  const callId = String(call.id || message.callId || payload.id || '');

  let extract;
  try {
    extract = await extractIntakeConversation({
      transcript,
      shopName: ctx.companyName,
      serviceArea: ctx.receptionist.service_area,
      hoursNote: ctx.receptionist.business_hours_note,
      channel: 'voice',
    });
  } catch (err) {
    console.error('vapi extract', err);
    return NextResponse.json({ error: 'extract_failed' }, { status: 500 });
  }

  const mapped = mapGrokIntake(extract, fromPhone);

  if (mapped.needs_human) {
    await escalateToHuman({
      ctx,
      fromPhone: fromPhone || 'unknown',
      channel: 'voice',
      reason: mapped.summary || 'Voice caller needs a person',
    });
    return NextResponse.json({ ok: true, escalated: true });
  }

  if (!mapped.ready || !mapped.diagnosis) {
    await admin.from('intake_events').insert({
      company_id: ctx.companyId,
      channel: 'voice',
      from_phone: fromPhone,
      event_type: 'incomplete',
      payload: { summary: mapped.summary, callId },
    });
    return NextResponse.json({ ok: true, incomplete: true });
  }

  try {
    const { jobId, merged } = await processReadyIntake({
      ctx,
      channel: 'ai_voice',
      extract: mapped,
      transcript,
      externalId: callId,
      fromPhone,
    });

    await admin.from('intake_sessions').insert({
      company_id: ctx.companyId,
      channel: 'voice',
      from_phone: fromPhone || 'unknown',
      external_id: callId || null,
      status: 'completed',
      job_id: jobId,
      messages: [{ role: 'transcript', text: transcript, at: new Date().toISOString() }],
    });

    return NextResponse.json({ ok: true, jobId, merged });
  } catch (err) {
    console.error('vapi create job', err);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
}
