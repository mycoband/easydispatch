import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { extractIntakeConversation } from '@/lib/grok';
import { escalateToHuman } from '@/lib/intake/escalate';
import { mapGrokIntake } from '@/lib/intake/map-extract';
import { processReadyIntake } from '@/lib/intake/process';
import { intakeRateLimit } from '@/lib/intake/rate-limit';
import { resolveCompanyForInboundDid } from '@/lib/intake/resolve-company';
import { createServiceClient } from '@/lib/supabase/admin';
import { defaultGreeting } from '@/lib/intake/script';
import { normalizePhone } from '@/lib/twilio';

export const runtime = 'nodejs';

function twimlMessage(body: string) {
  const MessagingResponse = twilio.twiml.MessagingResponse;
  const twiml = new MessagingResponse();
  twiml.message(body);
  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const from = String(form.get('From') || '');
  const to = String(form.get('To') || '');
  const body = String(form.get('Body') || '').trim();
  const messageSid = String(form.get('MessageSid') || '');

  if (!from || !body) {
    return twimlMessage('Sorry — please text again with your name and what’s wrong.');
  }

  const rl = intakeRateLimit({
    key: `sms:${normalizePhone(from) || from}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return twimlMessage('Too many messages — please try again in a bit.');
  }

  const ctx = await resolveCompanyForInboundDid(to);
  if (!ctx) {
    return twimlMessage(
      'This phone number is not linked to an EasyDispatch shop yet. In Settings → Company, set Inbound Twilio number to this line, then try again.'
    );
  }
  if (!ctx.modules.ai || !ctx.modules.ai_receptionist) {
    return twimlMessage(
      `Thanks for texting ${ctx.companyName}. AI receptionist is not turned on yet — ask the shop to enable AI tools + AI receptionist under Settings → Feature modules.`
    );
  }

  const admin = createServiceClient();
  const fromNorm = normalizePhone(from) || from;

  let { data: session } = await admin
    .from('intake_sessions')
    .select('id, messages')
    .eq('company_id', ctx.companyId)
    .eq('from_phone', fromNorm)
    .eq('channel', 'sms')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  type Msg = { role: string; text: string; at: string };
  const prev = (Array.isArray(session?.messages)
    ? session!.messages
    : []) as Msg[];

  if (!session) {
    const greeting =
      ctx.receptionist.greeting || defaultGreeting(ctx.companyName);
    const { data: created } = await admin
      .from('intake_sessions')
      .insert({
        company_id: ctx.companyId,
        channel: 'sms',
        from_phone: fromNorm,
        external_id: messageSid || null,
        status: 'open',
        messages: [
          { role: 'assistant', text: greeting, at: new Date().toISOString() },
          { role: 'user', text: body, at: new Date().toISOString() },
        ],
      })
      .select('id, messages')
      .single();
    session = created;
    // First message after empty session: still process with both greeting context
    if (prev.length === 0 && created) {
      // fall through with created messages
    }
  } else {
    const nextMsgs = [
      ...prev,
      { role: 'user', text: body, at: new Date().toISOString() },
    ];
    await admin
      .from('intake_sessions')
      .update({
        messages: nextMsgs,
        updated_at: new Date().toISOString(),
        external_id: messageSid || null,
      })
      .eq('id', session.id);
    session = { ...session, messages: nextMsgs };
  }

  const messages = (session?.messages || []) as Msg[];
  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'Caller' : 'Assistant'}: ${m.text}`)
    .join('\n');

  let extract;
  try {
    extract = await extractIntakeConversation({
      transcript,
      shopName: ctx.companyName,
      serviceArea: ctx.receptionist.service_area,
      hoursNote: ctx.receptionist.business_hours_note,
      channel: 'sms',
    });
  } catch {
    return twimlMessage(
      'Thanks — tell me your name, address, and what’s going on with the system.'
    );
  }

  const mapped = mapGrokIntake(extract, fromNorm);

  if (mapped.needs_human) {
    const reply = await escalateToHuman({
      ctx,
      fromPhone: fromNorm,
      channel: 'sms',
      reason: mapped.summary || 'Caller requested a person',
    });
    if (session?.id) {
      await admin
        .from('intake_sessions')
        .update({
          status: 'abandoned',
          messages: [
            ...messages,
            { role: 'assistant', text: reply, at: new Date().toISOString() },
          ],
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id);
    }
    return twimlMessage(reply);
  }

  if (mapped.ready && mapped.diagnosis) {
    try {
      const { jobId } = await processReadyIntake({
        ctx,
        channel: 'ai_sms',
        extract: mapped,
        transcript,
        externalId: messageSid,
        fromPhone: fromNorm,
      });
      const reply =
        mapped.reply_to_caller ||
        `Thanks — we created a service request. Our office will text or call to schedule. Ref: job ${jobId.slice(0, 8)}.`;
      if (session?.id) {
        await admin
          .from('intake_sessions')
          .update({
            status: 'completed',
            job_id: jobId,
            messages: [
              ...messages,
              { role: 'assistant', text: reply, at: new Date().toISOString() },
            ],
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id);
      }
      return twimlMessage(reply.slice(0, 320));
    } catch (err) {
      console.error('intake sms create', err);
      return twimlMessage(
        'We hit a snag saving your request. Please try again or call the shop.'
      );
    }
  }

  const reply =
    mapped.reply_to_caller ||
    'Thanks — what’s the service address and what’s wrong with the system?';
  if (session?.id) {
    await admin
      .from('intake_sessions')
      .update({
        messages: [
          ...messages,
          { role: 'assistant', text: reply, at: new Date().toISOString() },
        ],
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);
  }
  return twimlMessage(reply.slice(0, 320));
}
