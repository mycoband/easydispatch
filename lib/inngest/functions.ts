import { inngest } from '@/lib/inngest/client';
import { notifyOfficeIntakeJob } from '@/lib/intake/notify';
import type { IntakeJobCreatedEvent } from '@/lib/inngest/events';

export const intakeJobCreatedFn = inngest.createFunction(
  {
    id: 'intake-job-created-notify',
    retries: 4,
  },
  { event: 'intake/job.created' },
  async ({ event }) => {
    const data = event.data as IntakeJobCreatedEvent;
    await notifyOfficeIntakeJob(data);
    return { ok: true, jobId: data.jobId };
  }
);

export const inngestFunctions = [intakeJobCreatedFn];
