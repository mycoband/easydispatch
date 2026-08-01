export function omwBody(opts: {
  techName: string | null | undefined;
  customerName: string | null | undefined;
  jobType: string | null | undefined;
  /** Minutes until arrival; defaults to a 20–30 window when omitted. */
  etaMinutes?: number | null;
  companyName?: string | null;
}) {
  const tech = opts.techName?.trim() || 'your technician';
  const customer = opts.customerName?.trim() || 'you';
  const type = opts.jobType?.trim() || 'service';
  const company = opts.companyName?.trim() || 'EasyDispatch';
  const eta =
    opts.etaMinutes && opts.etaMinutes > 0
      ? `ETA about ${opts.etaMinutes} minutes.`
      : 'ETA ~20-30 minutes.';
  return `Hi, this is ${tech} with ${company}. I'm on my way to ${customer} for the ${type}. ${eta}`;
}

export function reminderBody(opts: {
  jobType: string | null | undefined;
  whenLabel: string;
  companyName?: string | null;
}) {
  const type = opts.jobType?.trim() || 'service';
  const company = opts.companyName?.trim() || 'EasyDispatch';
  return `Reminder from ${company}: We have you scheduled for ${type} at ${opts.whenLabel}. Reply CONFIRM or call us if you need to reschedule.`;
}

export function confirmAppointmentBody(opts: {
  companyName?: string | null;
  customerName: string | null | undefined;
  jobType: string | null | undefined;
  whenLabel: string;
  confirmUrl: string;
}) {
  const company = opts.companyName?.trim() || 'EasyDispatch';
  const name = opts.customerName?.trim() || 'there';
  const type = opts.jobType?.trim() || 'service';
  return `Hi ${name}, ${company} has you scheduled for ${type} at ${opts.whenLabel}. Please confirm or request a reschedule: ${opts.confirmUrl}`;
}

export function invoiceSmsBody(opts: {
  customerName: string | null | undefined;
  amountLabel: string;
  link?: string | null;
  companyName?: string | null;
}) {
  const name = opts.customerName?.trim() || 'there';
  const company = opts.companyName?.trim() || 'EasyDispatch';
  const linkPart = opts.link
    ? ` Pay online: ${opts.link}`
    : ' Reply or call us with questions.';
  return `Hi ${name}, your ${company} invoice for ${opts.amountLabel} is ready.${linkPart}`;
}

export function formatScheduleLabel(iso: string | null | undefined) {
  if (!iso) return 'your scheduled time';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'your scheduled time';
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
