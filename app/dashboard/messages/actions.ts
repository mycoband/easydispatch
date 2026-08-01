'use server';

import { revalidatePath } from 'next/cache';
import { requireProfile, isOfficeRole } from '@/lib/auth';
import { sendAndLogOutboundSms } from '@/lib/messages/send';
import {
  confirmAppointmentBody,
  formatScheduleLabel,
  omwBody,
  reminderBody,
} from '@/lib/messages/templates';
import { deriveLiveStatus } from '@/lib/jobs/time-tracking';
import { loadCompanySettings } from '@/lib/company';
import { assertTechCapability } from '@/lib/company/require-permission';

export type MessageActionState = {
  error?: string;
  success?: string;
  simulated?: boolean;
  sent?: number;
  failed?: number;
};

function revalidateJobMessages(jobId: string) {
  revalidatePath(`/dashboard/jobs/${jobId}`);
  revalidatePath(`/tech/jobs/${jobId}`);
  revalidatePath('/dashboard/dispatch');
  revalidatePath('/dashboard');
}

async function loadJobForMessage(jobId: string) {
  const { supabase, user, profile } = await requireProfile();

  const { data: job, error } = await supabase
    .from('jobs')
    .select(
      'id, customer_id, customer_name, job_type, status, assigned_to, assigned_to_name, scheduled_start, drive_started_at, check_in_at, check_out_at, confirmation_token, confirmation_status'
    )
    .eq('id', jobId)
    .maybeSingle();

  if (error || !job) {
    throw new Error(error?.message || 'Job not found');
  }

  const office = isOfficeRole(profile.role);
  const assignedTech = job.assigned_to === user.id;
  if (!office && !assignedTech) {
    throw new Error('You are not assigned to this job');
  }

  let phone: string | null = null;
  if (job.customer_id) {
    const { data: customer } = await supabase
      .from('customers')
      .select('phone')
      .eq('id', job.customer_id)
      .maybeSingle();
    phone = customer?.phone ?? null;
  }

  return { supabase, user, profile, job, phone, office };
}

export async function sendOmwSms(
  jobId: string,
  etaMinutes?: number | null
): Promise<MessageActionState> {
  try {
    const perm = await assertTechCapability('messaging');
    if (!perm.ok) return { error: perm.error };
    const { supabase, job, phone, profile } = await loadJobForMessage(jobId);
    if (!phone) return { error: 'Customer has no phone number' };

    const techName =
      job.assigned_to_name || profile.full_name || 'your technician';
    const company = await loadCompanySettings();

    const body = omwBody({
      techName,
      customerName: job.customer_name,
      jobType: job.job_type,
      etaMinutes: etaMinutes ?? null,
      companyName: company.sms_signature || company.name,
    });

    const result = await sendAndLogOutboundSms(supabase, {
      jobId: job.id,
      customerId: job.customer_id,
      to: phone,
      body,
      kind: 'omw',
    });

    if (!result.ok) return { error: result.error || 'Failed to send OMW' };

    revalidateJobMessages(jobId);
    return {
      success: result.simulated
        ? `OMW logged (Twilio not configured) → ${result.to}`
        : `On My Way sent to ${result.to}`,
      simulated: result.simulated,
      sent: 1,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'OMW failed',
    };
  }
}

export async function sendReminderSms(
  jobId: string
): Promise<MessageActionState> {
  try {
    const perm = await assertTechCapability('messaging');
    if (!perm.ok) return { error: perm.error };
    const { supabase, job, phone } = await loadJobForMessage(jobId);
    if (!phone) return { error: 'Customer has no phone number' };

    const company = await loadCompanySettings();
    const body = reminderBody({
      jobType: job.job_type,
      whenLabel: formatScheduleLabel(job.scheduled_start),
      companyName: company.sms_signature || company.name,
    });

    const result = await sendAndLogOutboundSms(supabase, {
      jobId: job.id,
      customerId: job.customer_id,
      to: phone,
      body,
      kind: 'reminder',
    });

    if (!result.ok) return { error: result.error || 'Failed to send reminder' };

    revalidateJobMessages(jobId);
    return {
      success: result.simulated
        ? `Reminder logged (Twilio not configured) → ${result.to}`
        : `Reminder sent to ${result.to}`,
      simulated: result.simulated,
      sent: 1,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Reminder failed',
    };
  }
}

export async function sendConfirmSms(jobId: string): Promise<MessageActionState> {
  try {
    const perm = await assertTechCapability('messaging');
    if (!perm.ok) return { error: perm.error };
    const { supabase, job, phone } = await loadJobForMessage(jobId);
    if (!phone) return { error: 'Customer has no phone number' };

    const token = job.confirmation_token || crypto.randomUUID();
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const confirmUrl = `${appUrl}/confirm/${token}`;

    const company = await loadCompanySettings();
    const body = confirmAppointmentBody({
      companyName: company.sms_signature || company.name,
      customerName: job.customer_name,
      jobType: job.job_type,
      whenLabel: formatScheduleLabel(job.scheduled_start),
      confirmUrl,
    });

    const result = await sendAndLogOutboundSms(supabase, {
      jobId: job.id,
      customerId: job.customer_id,
      to: phone,
      body,
      kind: 'confirm',
    });

    if (!result.ok) return { error: result.error || 'Failed to send confirmation' };

    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        confirmation_token: token,
        confirmation_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (updateError) return { error: updateError.message };

    revalidateJobMessages(jobId);
    return {
      success: result.simulated
        ? `Confirmation logged (Twilio not configured) → ${result.to}`
        : `Confirmation request sent to ${result.to}`,
      simulated: result.simulated,
      sent: 1,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Confirmation send failed',
    };
  }
}

export async function sendCustomJobSms(
  jobId: string,
  message: string
): Promise<MessageActionState> {
  try {
    const body = message.trim();
    if (!body) return { error: 'Message is empty' };
    if (body.length > 480) return { error: 'Message too long (max 480 chars)' };

    const { supabase, job, phone, office } = await loadJobForMessage(jobId);
    if (!office) return { error: 'Only office can send custom texts' };
    if (!phone) return { error: 'Customer has no phone number' };

    const result = await sendAndLogOutboundSms(supabase, {
      jobId: job.id,
      customerId: job.customer_id,
      to: phone,
      body,
      kind: 'text',
    });

    if (!result.ok) return { error: result.error || 'Failed to send text' };

    revalidateJobMessages(jobId);
    return {
      success: result.simulated
        ? `Text logged (Twilio not configured) → ${result.to}`
        : `Text sent to ${result.to}`,
      simulated: result.simulated,
      sent: 1,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Text failed',
    };
  }
}

/** Office: reminders for today's scheduled / new jobs with phones. */
export async function sendDayReminders(): Promise<MessageActionState> {
  try {
    const { supabase, profile } = await requireProfile();
    if (!isOfficeRole(profile.role)) {
      return { error: 'Office only' };
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const { data: jobs, error } = await supabase
      .from('jobs')
      .select(
        'id, customer_id, customer_name, job_type, status, scheduled_start'
      )
      .in('status', ['New', 'Scheduled'])
      .gte('scheduled_start', start.toISOString())
      .lte('scheduled_start', end.toISOString())
      .limit(100);

    if (error) return { error: error.message };

    const list = jobs ?? [];
    if (list.length === 0) {
      return { error: 'No jobs scheduled today to remind' };
    }

    const customerIds = [
      ...new Set(list.map((j) => j.customer_id).filter(Boolean) as string[]),
    ];
    const { data: customers } = await supabase
      .from('customers')
      .select('id, phone')
      .in('id', customerIds);

    const phoneById = new Map(
      (customers ?? []).map((c) => [c.id, c.phone] as const)
    );

    let sent = 0;
    let failed = 0;
    let simulated = false;

    for (const job of list) {
      const phone = job.customer_id
        ? phoneById.get(job.customer_id)
        : null;
      if (!phone) {
        failed += 1;
        continue;
      }
      const result = await sendAndLogOutboundSms(supabase, {
        jobId: job.id,
        customerId: job.customer_id,
        to: phone,
        body: reminderBody({
          jobType: job.job_type,
          whenLabel: formatScheduleLabel(job.scheduled_start),
        }),
        kind: 'reminder',
      });
      if (result.ok) {
        sent += 1;
        if (result.simulated) simulated = true;
        revalidatePath(`/dashboard/jobs/${job.id}`);
      } else {
        failed += 1;
      }
    }

    revalidatePath('/dashboard/dispatch');
    revalidatePath('/dashboard');

    if (sent === 0) {
      return { error: 'No reminders sent (missing phones?)', failed };
    }

    return {
      success: simulated
        ? `Logged ${sent} day reminder(s)${failed ? `, ${failed} skipped` : ''} (Twilio not configured)`
        : `Sent ${sent} day reminder(s)${failed ? `, ${failed} skipped` : ''}`,
      simulated,
      sent,
      failed,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Day reminders failed',
    };
  }
}

/** Office: OMW to all currently En Route jobs. */
export async function sendBulkOmw(): Promise<MessageActionState> {
  try {
    const { supabase, profile } = await requireProfile();
    if (!isOfficeRole(profile.role)) {
      return { error: 'Office only' };
    }

    const { data: jobs, error } = await supabase
      .from('jobs')
      .select(
        'id, customer_id, customer_name, job_type, status, assigned_to, assigned_to_name, drive_started_at, check_in_at, check_out_at'
      )
      .neq('status', 'Cancelled')
      .neq('status', 'Completed')
      .not('drive_started_at', 'is', null)
      .is('check_in_at', null)
      .limit(100);

    if (error) return { error: error.message };

    const enRoute = (jobs ?? []).filter(
      (j) => deriveLiveStatus(j) === 'En Route'
    );

    if (enRoute.length === 0) {
      return {
        error:
          'No techs currently En Route. Use Drive Start on a job first.',
      };
    }

    const customerIds = [
      ...new Set(
        enRoute.map((j) => j.customer_id).filter(Boolean) as string[]
      ),
    ];
    const { data: customers } = await supabase
      .from('customers')
      .select('id, phone')
      .in('id', customerIds);

    const phoneById = new Map(
      (customers ?? []).map((c) => [c.id, c.phone] as const)
    );

    let sent = 0;
    let failed = 0;
    let simulated = false;

    for (const job of enRoute) {
      const phone = job.customer_id
        ? phoneById.get(job.customer_id)
        : null;
      if (!phone) {
        failed += 1;
        continue;
      }
      const result = await sendAndLogOutboundSms(supabase, {
        jobId: job.id,
        customerId: job.customer_id,
        to: phone,
        body: omwBody({
          techName: job.assigned_to_name,
          customerName: job.customer_name,
          jobType: job.job_type,
        }),
        kind: 'omw',
      });
      if (result.ok) {
        sent += 1;
        if (result.simulated) simulated = true;
        revalidatePath(`/dashboard/jobs/${job.id}`);
      } else {
        failed += 1;
      }
    }

    revalidatePath('/dashboard/dispatch');

    if (sent === 0) {
      return { error: 'No OMW texts sent (missing phones?)', failed };
    }

    return {
      success: simulated
        ? `Logged ${sent} OMW text(s)${failed ? `, ${failed} skipped` : ''} (Twilio not configured)`
        : `Sent ${sent} OMW text(s)${failed ? `, ${failed} skipped` : ''}`,
      simulated,
      sent,
      failed,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Bulk OMW failed',
    };
  }
}
