'use server';

import { revalidatePath } from 'next/cache';
import { requireOffice, requireProfile, isOfficeRole } from '@/lib/auth';
import { emptyToNull } from '@/lib/validations/customer';

export type ActionState = { error?: string; success?: string };

function formString(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === 'string' ? v : '';
}

function revalidateCustomer(customerId: string, jobId?: string | null) {
  revalidatePath(`/dashboard/customers/${customerId}`);
  revalidatePath('/dashboard/customers');
  revalidatePath('/dashboard/jobs');
  if (jobId) {
    revalidatePath(`/dashboard/jobs/${jobId}`);
    revalidatePath(`/tech/jobs/${jobId}`);
  }
}

export async function upsertProperty(
  customerId: string,
  propertyId: string | null,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireOffice();
  const name = formString(formData, 'name').trim() || 'Site';
  const isPrimary = formData.get('is_primary') === 'on';

  const payload = {
    customer_id: customerId,
    name,
    address: emptyToNull(formString(formData, 'address')),
    city: emptyToNull(formString(formData, 'city')),
    state: emptyToNull(formString(formData, 'state')) || 'MO',
    zip: emptyToNull(formString(formData, 'zip')),
    access_notes: emptyToNull(formString(formData, 'access_notes')),
    gate_code: emptyToNull(formString(formData, 'gate_code')),
    lockbox_code: emptyToNull(formString(formData, 'lockbox_code')),
    notes: emptyToNull(formString(formData, 'notes')),
    is_primary: isPrimary,
    updated_at: new Date().toISOString(),
  };

  if (isPrimary) {
    await supabase
      .from('properties')
      .update({ is_primary: false })
      .eq('customer_id', customerId);
  }

  if (propertyId) {
    const { error } = await supabase
      .from('properties')
      .update(payload)
      .eq('id', propertyId)
      .eq('customer_id', customerId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('properties').insert(payload);
    if (error) return { error: error.message };
  }

  // Keep customer address in sync with primary site for legacy screens
  if (isPrimary || !propertyId) {
    const { data: primary } = await supabase
      .from('properties')
      .select('*')
      .eq('customer_id', customerId)
      .eq('is_primary', true)
      .maybeSingle();
    if (primary) {
      await supabase
        .from('customers')
        .update({
          address: primary.address,
          city: primary.city,
          state: primary.state,
          zip: primary.zip,
          access_notes: primary.access_notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId);
    }
  }

  revalidateCustomer(customerId);
  return { success: propertyId ? 'Site updated' : 'Site added' };
}

export async function deleteProperty(
  customerId: string,
  propertyId: string
): Promise<ActionState> {
  const { supabase } = await requireOffice();
  const { count } = await supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId);

  if ((count || 0) <= 1) {
    return { error: 'Keep at least one site on the customer' };
  }

  const { error } = await supabase
    .from('properties')
    .delete()
    .eq('id', propertyId)
    .eq('customer_id', customerId);

  if (error) return { error: error.message };
  revalidateCustomer(customerId);
  return { success: 'Site removed' };
}

export async function setJobProperty(
  jobId: string,
  propertyId: string
): Promise<ActionState> {
  const { supabase, user, profile } = await requireProfile();
  const { data: job } = await supabase
    .from('jobs')
    .select('id, customer_id, assigned_to')
    .eq('id', jobId)
    .maybeSingle();
  if (!job) return { error: 'Job not found' };
  if (!isOfficeRole(profile.role) && job.assigned_to !== user.id) {
    return { error: 'Not allowed' };
  }

  const { data: property } = await supabase
    .from('properties')
    .select('id, customer_id, name, address, city, state, zip')
    .eq('id', propertyId)
    .maybeSingle();
  if (!property) return { error: 'Site not found' };
  if (job.customer_id && property.customer_id !== job.customer_id) {
    return { error: 'Site belongs to another customer' };
  }

  const { error } = await supabase
    .from('jobs')
    .update({
      property_id: propertyId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) return { error: error.message };
  revalidateCustomer(property.customer_id, jobId);
  return { success: `Job site → ${property.name}` };
}
