import { createJobFromIntake } from '@/lib/intake/create-job';
import { notifyOfficeIntakeJob } from '@/lib/intake/notify';
import { sendIntakeJobCreated } from '@/lib/inngest/events';
import type { IntakeChannel, IntakeExtract } from '@/lib/intake/types';
import type { IntakeCompanyContext } from '@/lib/intake/resolve-company';

/** Shared path for SMS + voice after Grok extract is ready. */
export async function processReadyIntake(opts: {
  ctx: IntakeCompanyContext;
  channel: IntakeChannel;
  extract: IntakeExtract;
  transcript: string;
  externalId?: string | null;
  fromPhone?: string | null;
}): Promise<{ jobId: string; merged: boolean }> {
  const result = await createJobFromIntake({
    companyId: opts.ctx.companyId,
    channel: opts.channel,
    extract: opts.extract,
    transcript: opts.transcript,
    externalId: opts.externalId,
  });

  const payload = {
    companyId: opts.ctx.companyId,
    companyName: opts.ctx.companyName,
    jobId: result.jobId,
    customerName: opts.extract.customer_name,
    channel: opts.channel,
    summary: opts.extract.summary,
    ownerEmail: opts.ctx.ownerEmail,
    ownerPhone: opts.ctx.ownerPhone || opts.ctx.receptionist.escalate_phone,
    merged: result.merged,
  };

  // Prefer Inngest when configured; always notify inline as fallback.
  const queued = await sendIntakeJobCreated(payload);
  if (!queued) {
    await notifyOfficeIntakeJob(payload);
  }

  return { jobId: result.jobId, merged: result.merged };
}
