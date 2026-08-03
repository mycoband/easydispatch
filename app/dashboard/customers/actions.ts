'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  isOfficeRole,
  requireOffice,
  requireProfile,
} from '@/lib/auth';
import { assertPermission, assertTechCapability } from '@/lib/company/require-permission';
import {
  customerSchema,
  emptyToNull,
} from '@/lib/validations/customer';
import {
  equipmentSchema,
  parseFilterQty,
} from '@/lib/validations/equipment';

export type ActionState = {
  error?: string;
  success?: string;
};

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/** Office, or a tech assigned to a job for this customer. */
async function requireEquipmentAccess(customerId: string) {
  const { supabase, user, profile } = await requireProfile();
  if (isOfficeRole(profile.role)) {
    return { supabase, user, profile };
  }

  const perm = await assertTechCapability('manage_equipment');
  if (!perm.ok) throw new Error(perm.error);

  const { data: job } = await supabase
    .from('jobs')
    .select('id')
    .eq('customer_id', customerId)
    .eq('assigned_to', user.id)
    .neq('status', 'Cancelled')
    .limit(1)
    .maybeSingle();

  if (!job) {
    throw new Error('You can only manage equipment on your assigned jobs');
  }

  return { supabase, user, profile };
}

function revalidateEquipmentPaths(customerId: string, jobId?: string | null) {
  revalidatePath(`/dashboard/customers/${customerId}`);
  if (jobId) {
    revalidatePath(`/dashboard/jobs/${jobId}`);
    revalidatePath(`/tech/jobs/${jobId}`);
  }
  revalidatePath('/dashboard/jobs');
  revalidatePath('/tech');
}

export async function linkEquipmentToJob(
  jobId: string,
  equipmentId: string
): Promise<ActionState> {
  try {
    const { supabase, user, profile } = await requireProfile();
    const { data: job } = await supabase
      .from('jobs')
      .select('id, customer_id, assigned_to')
      .eq('id', jobId)
      .maybeSingle();

    if (!job) return { error: 'Job not found' };

    const office = isOfficeRole(profile.role);
    if (!office && job.assigned_to !== user.id) {
      return { error: 'You are not assigned to this job' };
    }

    const { data: equipment } = await supabase
      .from('equipment')
      .select('id, customer_id')
      .eq('id', equipmentId)
      .maybeSingle();

    if (!equipment) return { error: 'Equipment not found' };
    if (
      job.customer_id &&
      equipment.customer_id &&
      job.customer_id !== equipment.customer_id
    ) {
      return { error: 'Equipment belongs to a different customer' };
    }

    const { error } = await supabase
      .from('jobs')
      .update({
        equipment_id: equipmentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) return { error: error.message };
    revalidateEquipmentPaths(equipment.customer_id, jobId);
    return { success: 'Linked to this job' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Link failed' };
  }
}

export async function createCustomer(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, profile } = await requireOffice();
  if (!profile.company_id) {
    return {
      error:
        'Your account is not linked to a company yet. Sign out and back in, then try again.',
    };
  }

  const parsed = customerSchema.safeParse({
    name: formString(formData, 'name'),
    address: formString(formData, 'address'),
    city: formString(formData, 'city'),
    state: formString(formData, 'state') || 'MO',
    zip: formString(formData, 'zip'),
    phone: formString(formData, 'phone'),
    email: formString(formData, 'email'),
    notes: formString(formData, 'notes'),
    access_notes: formString(formData, 'access_notes'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid customer' };
  }

  const { data, error } = await supabase
    .from('customers')
    .insert({
      company_id: profile.company_id,
      name: parsed.data.name,
      address: emptyToNull(parsed.data.address),
      city: emptyToNull(parsed.data.city),
      state: emptyToNull(parsed.data.state) || 'MO',
      zip: emptyToNull(parsed.data.zip),
      phone: emptyToNull(parsed.data.phone),
      email: emptyToNull(parsed.data.email),
      notes: emptyToNull(parsed.data.notes),
      access_notes: emptyToNull(parsed.data.access_notes),
    })
    .select('id')
    .single();

  if (error || !data) {
    return { error: error?.message || 'Could not create customer' };
  }

  // Always create a primary site so multi-property works from day one
  await supabase.from('properties').insert({
    company_id: profile.company_id,
    customer_id: data.id,
    name: 'Primary',
    address: emptyToNull(parsed.data.address),
    city: emptyToNull(parsed.data.city),
    state: emptyToNull(parsed.data.state) || 'MO',
    zip: emptyToNull(parsed.data.zip),
    access_notes: emptyToNull(parsed.data.access_notes),
    is_primary: true,
  });

  revalidatePath('/dashboard/customers');
  revalidatePath('/dashboard');
  redirect(`/dashboard/customers/${data.id}`);
}

export async function updateCustomer(
  customerId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireOffice();

  const parsed = customerSchema.safeParse({
    name: formString(formData, 'name'),
    address: formString(formData, 'address'),
    city: formString(formData, 'city'),
    state: formString(formData, 'state') || 'MO',
    zip: formString(formData, 'zip'),
    phone: formString(formData, 'phone'),
    email: formString(formData, 'email'),
    notes: formString(formData, 'notes'),
    access_notes: formString(formData, 'access_notes'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || 'Invalid customer' };
  }

  const { error } = await supabase
    .from('customers')
    .update({
      name: parsed.data.name,
      address: emptyToNull(parsed.data.address),
      city: emptyToNull(parsed.data.city),
      state: emptyToNull(parsed.data.state) || 'MO',
      zip: emptyToNull(parsed.data.zip),
      phone: emptyToNull(parsed.data.phone),
      email: emptyToNull(parsed.data.email),
      notes: emptyToNull(parsed.data.notes),
      access_notes: emptyToNull(parsed.data.access_notes),
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/dashboard/customers');
  revalidatePath(`/dashboard/customers/${customerId}`);
  revalidatePath('/dashboard');
  return { success: 'Customer updated' };
}

export async function deleteCustomer(customerId: string): Promise<ActionState> {
  const { supabase } = await requireOffice();
  const perm = await assertPermission('delete_customers');
  if (!perm.ok) return { error: perm.error };

  const { error } = await supabase.from('customers').delete().eq('id', customerId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/dashboard/customers');
  revalidatePath('/dashboard');
  redirect('/dashboard/customers');
}

export async function createEquipment(
  customerId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase } = await requireEquipmentAccess(customerId);
    const jobId = emptyToNull(formString(formData, 'job_id'));

    const parsed = equipmentSchema.safeParse({
      name: formString(formData, 'name'),
      equipment_type: formString(formData, 'equipment_type'),
      manufacturer: formString(formData, 'manufacturer'),
      model: formString(formData, 'model'),
      serial_number: formString(formData, 'serial_number'),
      capacity: formString(formData, 'capacity'),
      electrical: formString(formData, 'electrical'),
      refrigerant: formString(formData, 'refrigerant'),
      filter_size: formString(formData, 'filter_size'),
      filter_qty: formString(formData, 'filter_qty'),
      install_date: formString(formData, 'install_date'),
      property_id: formString(formData, 'property_id'),
      warranty_parts_expires: formString(formData, 'warranty_parts_expires'),
      warranty_labor_expires: formString(formData, 'warranty_labor_expires'),
      warranty_notes: formString(formData, 'warranty_notes'),
      notes: formString(formData, 'notes'),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || 'Invalid equipment' };
    }

    const { data: equipment, error } = await supabase
      .from('equipment')
      .insert({
        customer_id: customerId,
        name: emptyToNull(parsed.data.name),
        equipment_type: parsed.data.equipment_type,
        manufacturer: emptyToNull(parsed.data.manufacturer),
        model: emptyToNull(parsed.data.model),
        serial_number: emptyToNull(parsed.data.serial_number),
        capacity: emptyToNull(parsed.data.capacity),
        electrical: emptyToNull(parsed.data.electrical),
        refrigerant: emptyToNull(parsed.data.refrigerant),
        filter_size: emptyToNull(parsed.data.filter_size),
        filter_qty: parseFilterQty(parsed.data.filter_qty),
        install_date: emptyToNull(parsed.data.install_date),
        property_id: emptyToNull(parsed.data.property_id),
        warranty_parts_expires: emptyToNull(
          parsed.data.warranty_parts_expires
        ),
        warranty_labor_expires: emptyToNull(
          parsed.data.warranty_labor_expires
        ),
        warranty_notes: emptyToNull(parsed.data.warranty_notes),
        notes: emptyToNull(parsed.data.notes),
      })
      .select('id')
      .single();

    if (error || !equipment) {
      return { error: error?.message || 'Could not add equipment' };
    }

    if (jobId) {
      await supabase
        .from('jobs')
        .update({
          equipment_id: equipment.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }

    revalidateEquipmentPaths(customerId, jobId);
    return { success: 'Equipment added' };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not add equipment',
    };
  }
}

export async function updateEquipment(
  customerId: string,
  equipmentId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const { supabase } = await requireEquipmentAccess(customerId);
    const jobId = emptyToNull(formString(formData, 'job_id'));

    const parsed = equipmentSchema.safeParse({
      name: formString(formData, 'name'),
      equipment_type: formString(formData, 'equipment_type'),
      manufacturer: formString(formData, 'manufacturer'),
      model: formString(formData, 'model'),
      serial_number: formString(formData, 'serial_number'),
      capacity: formString(formData, 'capacity'),
      electrical: formString(formData, 'electrical'),
      refrigerant: formString(formData, 'refrigerant'),
      filter_size: formString(formData, 'filter_size'),
      filter_qty: formString(formData, 'filter_qty'),
      install_date: formString(formData, 'install_date'),
      property_id: formString(formData, 'property_id'),
      warranty_parts_expires: formString(formData, 'warranty_parts_expires'),
      warranty_labor_expires: formString(formData, 'warranty_labor_expires'),
      warranty_notes: formString(formData, 'warranty_notes'),
      notes: formString(formData, 'notes'),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || 'Invalid equipment' };
    }

    const { error } = await supabase
      .from('equipment')
      .update({
        name: emptyToNull(parsed.data.name),
        equipment_type: parsed.data.equipment_type,
        manufacturer: emptyToNull(parsed.data.manufacturer),
        model: emptyToNull(parsed.data.model),
        serial_number: emptyToNull(parsed.data.serial_number),
        capacity: emptyToNull(parsed.data.capacity),
        electrical: emptyToNull(parsed.data.electrical),
        refrigerant: emptyToNull(parsed.data.refrigerant),
        filter_size: emptyToNull(parsed.data.filter_size),
        filter_qty: parseFilterQty(parsed.data.filter_qty),
        install_date: emptyToNull(parsed.data.install_date),
        property_id: emptyToNull(parsed.data.property_id),
        warranty_parts_expires: emptyToNull(
          parsed.data.warranty_parts_expires
        ),
        warranty_labor_expires: emptyToNull(
          parsed.data.warranty_labor_expires
        ),
        warranty_notes: emptyToNull(parsed.data.warranty_notes),
        notes: emptyToNull(parsed.data.notes),
        updated_at: new Date().toISOString(),
      })
      .eq('id', equipmentId)
      .eq('customer_id', customerId);

    if (error) {
      return { error: error.message };
    }

    revalidateEquipmentPaths(customerId, jobId);
    return { success: 'Equipment updated' };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not update equipment',
    };
  }
}

export async function deleteEquipment(
  customerId: string,
  equipmentId: string
): Promise<ActionState> {
  try {
    const { supabase } = await requireEquipmentAccess(customerId);

    const { error } = await supabase
      .from('equipment')
      .delete()
      .eq('id', equipmentId)
      .eq('customer_id', customerId);

    if (error) {
      return { error: error.message };
    }

    revalidateEquipmentPaths(customerId);
    return { success: 'Equipment removed' };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not remove equipment',
    };
  }
}

export async function saveEquipmentPmChecklist(
  customerId: string,
  equipmentId: string,
  checklist: unknown,
  jobId?: string | null
): Promise<ActionState> {
  try {
    const { serializePmChecklist, normalizePmChecklist } = await import(
      '@/lib/equipment/pm-checklist'
    );
    const { supabase } = await requireEquipmentAccess(customerId);
    const doc = serializePmChecklist(normalizePmChecklist(checklist));
    if (!doc.items.length) {
      return { error: 'Add at least one checklist item' };
    }
    if (doc.items.some((i) => !i.label.trim())) {
      return { error: 'Every item needs a label' };
    }

    const { error } = await supabase
      .from('equipment')
      .update({
        pm_checklist: doc,
        updated_at: new Date().toISOString(),
      })
      .eq('id', equipmentId)
      .eq('customer_id', customerId);

    if (error) {
      return {
        error: /pm_checklist|column|schema cache/i.test(error.message)
          ? 'Could not save checklist. Refresh and try again, or contact support.'
          : error.message,
      };
    }
    revalidateEquipmentPaths(customerId, jobId);
    if (jobId) {
      revalidatePath(`/tech/jobs/${jobId}`);
      revalidatePath(`/dashboard/jobs/${jobId}`);
    }
    return { success: 'PM checklist saved' };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not save checklist',
    };
  }
}

/**
 * Upload a photo for a PM checklist item; stores URL on the unit checklist
 * and also creates a job photo when jobId is provided.
 */
export async function uploadPmChecklistPhoto(
  customerId: string,
  equipmentId: string,
  itemId: string,
  formData: FormData
): Promise<ActionState & { url?: string }> {
  try {
    const {
      normalizePmChecklist,
      serializePmChecklist,
    } = await import('@/lib/equipment/pm-checklist');
    const { createServiceClient } = await import('@/lib/supabase/admin');
    const { supabase, user, profile } =
      await requireEquipmentAccess(customerId);

    const jobId = emptyToNull(formString(formData, 'job_id'));
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return { error: 'Photo required' };
    }
    if (file.size > 20 * 1024 * 1024) {
      return { error: 'File too large (max 20MB)' };
    }
    if (!file.type.startsWith('image/')) {
      return { error: 'Image files only' };
    }

    const { data: equip, error: loadErr } = await supabase
      .from('equipment')
      .select('id, pm_checklist, name, equipment_type')
      .eq('id', equipmentId)
      .eq('customer_id', customerId)
      .maybeSingle();
    if (loadErr || !equip) {
      return { error: loadErr?.message || 'Equipment not found' };
    }

    const doc = normalizePmChecklist(equip.pm_checklist);
    const item = doc.items.find((i) => i.id === itemId);
    if (!item) return { error: 'Checklist item not found — save items first' };

    // Validate job belongs to this company + customer before any service-role write.
    let jobCompanyId: string | null = null;
    if (jobId) {
      if (!profile.company_id) {
        return { error: 'No company on profile' };
      }
      const { data: jobRow, error: jobErr } = await supabase
        .from('jobs')
        .select('id, company_id, customer_id')
        .eq('id', jobId)
        .eq('company_id', profile.company_id)
        .eq('customer_id', customerId)
        .maybeSingle();
      if (jobErr || !jobRow) {
        return { error: 'Job not found for this customer' };
      }
      jobCompanyId =
        (jobRow.company_id as string | null) || profile.company_id;
    }

    const admin = createServiceClient();
    const ext =
      file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
          ? 'webp'
          : 'jpg';
    const path = jobId
      ? `${jobId}/pm-${itemId}-${Date.now()}.${ext}`
      : `equipment/${equipmentId}/pm-${itemId}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from('job-media')
      .upload(path, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      });
    if (uploadError) {
      return {
        error: `Upload failed: ${uploadError.message}. Confirm job-media bucket exists.`,
      };
    }

    const { data: urlData } = admin.storage.from('job-media').getPublicUrl(path);
    const url = urlData.publicUrl;
    const now = new Date().toISOString();

    let attachmentId: string | null = null;
    if (jobId) {
      const unitLabel =
        equip.name || equip.equipment_type || 'Unit';
      const companyId = jobCompanyId || profile.company_id || null;

      const { data: att, error: attErr } = await admin
        .from('job_attachments')
        .insert({
          job_id: jobId,
          kind: 'photo',
          tag: 'pm',
          url,
          caption: `PM: ${item.label} · ${unitLabel}`,
          created_by: user.id,
          ...(companyId ? { company_id: companyId } : {}),
        })
        .select('id')
        .maybeSingle();
      if (attErr) {
        return { error: attErr.message };
      }
      attachmentId = att?.id || null;
    }

    const prev = doc.checks[itemId] || {
      checked: false,
      at: null,
      photos: [],
    };
    doc.checks[itemId] = {
      ...prev,
      photos: [
        ...(prev.photos || []),
        { url, attachmentId, at: now },
      ],
    };

    const { error } = await supabase
      .from('equipment')
      .update({
        pm_checklist: serializePmChecklist(doc),
        updated_at: now,
      })
      .eq('id', equipmentId)
      .eq('customer_id', customerId);

    if (error) {
      return {
        error: /pm_checklist|column|schema cache/i.test(error.message)
          ? 'Could not save photo. Refresh and try again, or contact support.'
          : error.message,
      };
    }

    revalidateEquipmentPaths(customerId, jobId);
    if (jobId) {
      revalidatePath(`/tech/jobs/${jobId}`);
      revalidatePath(`/dashboard/jobs/${jobId}`);
    }
    return {
      success: jobId
        ? 'Photo saved on checklist and job photos'
        : 'Photo saved on checklist',
      url,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Photo upload failed',
    };
  }
}

/** Save Grok-extracted plate fields + photo to the property. */
export async function saveScannedEquipment(
  customerId: string,
  formData: FormData
): Promise<ActionState & { equipmentId?: string }> {
  try {
    const { supabase } = await requireEquipmentAccess(customerId);
    const { createServiceClient } = await import('@/lib/supabase/admin');
    const jobId = emptyToNull(formString(formData, 'job_id'));

    const parsed = equipmentSchema.safeParse({
      name: formString(formData, 'name'),
      equipment_type: formString(formData, 'equipment_type') || 'Other',
      manufacturer: formString(formData, 'manufacturer'),
      model: formString(formData, 'model'),
      serial_number: formString(formData, 'serial_number'),
      capacity: formString(formData, 'capacity'),
      electrical: formString(formData, 'electrical'),
      refrigerant: formString(formData, 'refrigerant'),
      filter_size: formString(formData, 'filter_size'),
      filter_qty: formString(formData, 'filter_qty'),
      install_date: formString(formData, 'install_date'),
      notes: formString(formData, 'notes'),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || 'Invalid equipment' };
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .maybeSingle();

    if (!customer) {
      return { error: 'Customer not found' };
    }

    let photoUrl: string | null = null;
    const file = formData.get('image');

    if (file instanceof File && file.size > 0) {
      const admin = createServiceClient();
      const ext =
        file.type === 'image/png'
          ? 'png'
          : file.type === 'image/webp'
            ? 'webp'
            : 'jpg';
      const fileName = `${customerId}/${Date.now()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await admin.storage
        .from('equipment-photos')
        .upload(fileName, buffer, {
          contentType: file.type || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        return {
          error: `Photo upload failed: ${uploadError.message}. Confirm the equipment-photos bucket exists.`,
        };
      }

      const { data: urlData } = admin.storage
        .from('equipment-photos')
        .getPublicUrl(fileName);
      photoUrl = urlData.publicUrl;
    }

    const { data: equipment, error } = await supabase
      .from('equipment')
      .insert({
        customer_id: customerId,
        name: emptyToNull(parsed.data.name),
        equipment_type: parsed.data.equipment_type,
        manufacturer: emptyToNull(parsed.data.manufacturer),
        model: emptyToNull(parsed.data.model),
        serial_number: emptyToNull(parsed.data.serial_number),
        capacity: emptyToNull(parsed.data.capacity),
        electrical: emptyToNull(parsed.data.electrical),
        refrigerant: emptyToNull(parsed.data.refrigerant),
        filter_size: emptyToNull(parsed.data.filter_size),
        filter_qty: parseFilterQty(parsed.data.filter_qty),
        install_date: emptyToNull(parsed.data.install_date),
        notes: emptyToNull(parsed.data.notes),
        photo_url: photoUrl,
      })
      .select('id')
      .single();

    if (error || !equipment) {
      return { error: error?.message || 'Could not save equipment' };
    }

    if (jobId) {
      await supabase
        .from('jobs')
        .update({
          equipment_id: equipment.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }

    revalidateEquipmentPaths(customerId, jobId);
    return {
      success: jobId
        ? 'Equipment saved and linked to this job'
        : 'Equipment saved from data plate',
      equipmentId: equipment.id,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Could not save equipment',
    };
  }
}
