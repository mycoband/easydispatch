import type { SupabaseClient } from '@supabase/supabase-js';

/** Compact job packet for the office job AI assistant (server-built). */
export async function loadJobAssistantContext(
  supabase: SupabaseClient,
  jobId: string,
  companyId: string | null | undefined
): Promise<{ context: string } | { error: string }> {
  let jobQuery = supabase
    .from('jobs')
    .select(
      `id, job_number, customer_id, customer_name, job_type, status, priority,
       assigned_to_name, diagnosis, notes, internal_notes, customer_summary,
       scheduled_start, drive_started_at, check_in_at, check_out_at, actual_hours,
       est_hours, subtotal, tax_amount, total, invoice_status, payment_status,
       stripe_payment_link, customer_approved_at, confirmation_status,
       is_callback, warranty_flag, walkthrough`
    )
    .eq('id', jobId);

  if (companyId) {
    jobQuery = jobQuery.eq('company_id', companyId);
  }

  const { data: job, error: jobError } = await jobQuery.maybeSingle();
  if (jobError) return { error: jobError.message };
  if (!job) return { error: 'Job not found' };

  const [linesRes, messagesRes, customerRes, attachRes] = await Promise.all([
    supabase
      .from('line_items')
      .select('description, qty, unit_price, item_type')
      .eq('job_id', jobId)
      .order('sort_order', { ascending: true })
      .limit(40),
    supabase
      .from('messages')
      .select('channel, direction, body, status, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(12),
    job.customer_id
      ? supabase
          .from('customers')
          .select('name, phone, email, city')
          .eq('id', job.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null as null, error: null }),
    supabase
      .from('job_attachments')
      .select('kind, caption, tag')
      .eq('job_id', jobId)
      .limit(30),
  ]);

  // Optional related data — ignore query failures so the assistant still works
  const lineItems = linesRes.error ? [] : linesRes.data || [];
  const messages = messagesRes.error ? [] : messagesRes.data || [];
  const attachmentsRows = attachRes.error ? [] : attachRes.data || [];
  const customer = customerRes.error ? null : customerRes.data;

  const walkthrough =
    job.walkthrough && typeof job.walkthrough === 'object'
      ? (job.walkthrough as Record<string, unknown>)
      : null;

  const wtSummary = walkthrough
    ? {
        status: walkthrough.status ?? null,
        findings: clip(String(walkthrough.findings || ''), 400),
        work_performed: clip(String(walkthrough.work_performed || ''), 400),
        customer_summary: clip(
          String(walkthrough.customer_summary || ''),
          300
        ),
        recommendations: clip(
          String(walkthrough.recommendations || ''),
          300
        ),
      }
    : null;

  const attachments = attachmentsRows.map((a) => ({
    kind: a.kind,
    tag: a.tag,
    caption: clip(a.caption || '', 80),
  }));

  const packet = {
    job: {
      number: job.job_number,
      customer: job.customer_name,
      type: job.job_type,
      status: job.status,
      priority: job.priority,
      tech: job.assigned_to_name,
      scheduled_start: job.scheduled_start,
      drive_started_at: job.drive_started_at,
      check_in_at: job.check_in_at,
      check_out_at: job.check_out_at,
      actual_hours: job.actual_hours,
      est_hours: job.est_hours,
      diagnosis: clip(job.diagnosis || '', 500),
      notes: clip(job.notes || '', 300),
      internal_notes: clip(job.internal_notes || '', 300),
      customer_summary: clip(job.customer_summary || '', 400),
      subtotal: job.subtotal,
      tax: job.tax_amount,
      total: job.total,
      invoice_status: job.invoice_status,
      payment_status: job.payment_status,
      has_pay_link: Boolean(job.stripe_payment_link),
      customer_approved_at: job.customer_approved_at,
      confirmation_status: job.confirmation_status,
      is_callback: job.is_callback,
      warranty_flag: job.warranty_flag,
    },
    customer: customer
      ? {
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          city: customer.city,
        }
      : null,
    line_items: lineItems.map((li) => ({
      description: li.description,
      qty: li.qty,
      unit_price: li.unit_price,
      type: li.item_type,
    })),
    recent_messages: messages.map((m) => ({
      channel: m.channel,
      direction: m.direction,
      status: m.status,
      body: clip(m.body || '', 200),
      at: m.created_at,
    })),
    attachments,
    walkthrough: wtSummary,
  };

  return { context: JSON.stringify(packet, null, 0) };
}

function clip(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
