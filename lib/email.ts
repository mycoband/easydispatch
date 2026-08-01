type EmailResult = {
  ok: boolean;
  id?: string;
  simulated: boolean;
  error?: string;
};

/**
 * Send email via Resend. Without RESEND_API_KEY, returns simulated success
 * so invoice flows still log to `messages`.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || 'EasyDispatch <onboarding@resend.dev>';

  if (!apiKey) {
    return {
      ok: true,
      simulated: true,
      id: `sim_email_${Date.now()}`,
    };
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html || opts.text.replace(/\n/g, '<br/>'),
    });
    if (error) {
      return { ok: false, simulated: false, error: error.message };
    }
    return { ok: true, simulated: false, id: data?.id };
  } catch (err) {
    return {
      ok: false,
      simulated: false,
      error: err instanceof Error ? err.message : 'Email send failed',
    };
  }
}
