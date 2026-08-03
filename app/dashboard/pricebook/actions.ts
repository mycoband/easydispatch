'use server';

import { revalidatePath } from 'next/cache';
import { requireOffice } from '@/lib/auth';
import { emptyToNull } from '@/lib/validations/customer';

export type ActionState = { error?: string; success?: string };

function formString(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === 'string' ? v : '';
}

export async function upsertPricebookItem(
  id: string | null,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireOffice();
  const name = formString(formData, 'name').trim();
  if (!name) return { error: 'Name required' };

  const itemTypeRaw = formString(formData, 'item_type').trim() || 'other';
  const item_type = ['labor', 'parts', 'other'].includes(itemTypeRaw)
    ? itemTypeRaw
    : 'other';

  const payload = {
    name,
    description: emptyToNull(formString(formData, 'description')) || name,
    category: formString(formData, 'category').trim() || 'General',
    unit_price: Number(formString(formData, 'unit_price')) || 0,
    unit_cost: Number(formString(formData, 'unit_cost')) || 0,
    item_type,
    taxable: formData.get('taxable') === 'on',
    active: formData.get('active') !== 'off',
    updated_at: new Date().toISOString(),
  };

  let { error } = id
    ? await supabase.from('pricebook_items').update(payload).eq('id', id)
    : await supabase.from('pricebook_items').insert(payload);

  if (error && /unit_cost|item_type|column|schema cache/i.test(error.message)) {
    const { unit_cost: _c, item_type: _t, ...legacy } = payload;
    const retry = id
      ? await supabase.from('pricebook_items').update(legacy).eq('id', id)
      : await supabase.from('pricebook_items').insert(legacy);
    error = retry.error;
    if (!error) {
      revalidatePath('/dashboard/pricebook');
      return {
        success: id
          ? 'Updated (cost fields unavailable — check Settings or contact support)'
          : 'Added (cost fields unavailable — check Settings or contact support)',
      };
    }
  }

  if (error) {
    return {
      error:
        error.message.includes('pricebook_items') || error.code === '42P01'
          ? 'Pricebook is unavailable. Refresh and try again, or contact support.'
          : error.message,
    };
  }
  revalidatePath('/dashboard/pricebook');
  revalidatePath('/dashboard/estimates');
  revalidatePath('/dashboard/jobs');
  return { success: id ? 'Updated' : 'Added' };
}

export async function deletePricebookItem(id: string): Promise<ActionState> {
  const { supabase } = await requireOffice();
  const { error } = await supabase.from('pricebook_items').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/dashboard/pricebook');
  return { success: 'Deleted' };
}
