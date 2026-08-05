import { Inngest } from 'inngest';

export const inngest = new Inngest({ id: 'easydispatch' });

export function inngestConfigured(): boolean {
  return Boolean(
    process.env.INNGEST_EVENT_KEY?.trim() ||
      process.env.INNGEST_SIGNING_KEY?.trim()
  );
}
