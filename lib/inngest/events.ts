import { inngest, inngestConfigured } from '@/lib/inngest/client';
import type { IntakeChannel } from '@/lib/intake/types';

export type IntakeJobCreatedEvent = {
  companyId: string;
  companyName: string;
  jobId: string;
  customerName: string;
  channel: IntakeChannel;
  summary: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  merged?: boolean;
};

/** Queue office notify via Inngest. Returns false if Inngest is not configured. */
export async function sendIntakeJobCreated(
  data: IntakeJobCreatedEvent
): Promise<boolean> {
  if (!inngestConfigured()) return false;
  try {
    await inngest.send({
      name: 'intake/job.created',
      data,
    });
    return true;
  } catch {
    return false;
  }
}
