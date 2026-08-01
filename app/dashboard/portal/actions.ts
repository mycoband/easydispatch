'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { requireOffice } from '@/lib/auth';

export type ActionState = { error?: string; success?: string; url?: string };

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'http://localhost:3000'
  );
}

export async function createPortalLink(input: {
  purpose: 'estimate' | 'invoice' | 'customer';
  customerId: string | null;
  estimateId?: string | null;
  jobId?: string | null;
}): Promise<ActionState> {
  const { supabase, profile } = await requireOffice();
  if (input.purpose === 'customer' && !input.customerId) {
    return { error: 'Customer required for portal link' };
  }
  const token = randomBytes(24).toString('hex');
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);

  const { error } = await supabase.from('portal_tokens').insert({
    token,
    purpose: input.purpose,
    customer_id: input.customerId,
    estimate_id: input.estimateId || null,
    job_id: input.jobId || null,
    company_id: profile.company_id || null,
    expires_at: expires.toISOString(),
  });

  if (error) {
    return {
      error:
        error.message.includes('portal_tokens') || error.code === '42P01'
          ? 'Run supabase/office-features.sql in Supabase first'
          : error.message,
    };
  }

  const url = `${appBaseUrl()}/portal/${token}`;
  revalidatePath('/dashboard/estimates');
  revalidatePath('/dashboard/invoices');
  return { success: 'Portal link created', url };
}
