'use server';

import { revalidatePath } from 'next/cache';
import { requireOffice } from '@/lib/auth';
import { emptyToNull } from '@/lib/validations/customer';

export type ActionState = { error?: string; success?: string };

function formString(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === 'string' ? v : '';
}

export async function upsertInventoryItem(
  id: string | null,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireOffice();
  const name = formString(formData, 'name').trim();
  if (!name) return { error: 'Name required' };

  const reorderRaw = formString(formData, 'reorder_qty').trim();
  const payload = {
    name,
    sku: emptyToNull(formString(formData, 'sku')),
    qty_on_hand: Number(formString(formData, 'qty_on_hand')) || 0,
    min_qty: Number(formString(formData, 'min_qty')) || 0,
    cost: Number(formString(formData, 'cost')) || 0,
    sell_price: Number(formString(formData, 'sell_price')) || 0,
    location: emptyToNull(formString(formData, 'location')),
    vendor: emptyToNull(formString(formData, 'vendor')),
    reorder_qty:
      reorderRaw === '' || !Number.isFinite(Number(reorderRaw))
        ? null
        : Number(reorderRaw),
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from('inventory_items').update(payload).eq('id', id)
    : await supabase.from('inventory_items').insert(payload);

  if (error) {
    return {
      error: /vendor|reorder_qty|column|schema cache/i.test(error.message)
        ? 'Vendor and reorder fields are unavailable. Refresh, check Settings, or contact support.'
        : error.message,
    };
  }
  revalidatePath('/dashboard/inventory');
  return { success: id ? 'Updated' : 'Added' };
}

export async function markInventoryOrdered(id: string): Promise<ActionState> {
  const { supabase } = await requireOffice();
  const { error } = await supabase
    .from('inventory_items')
    .update({
      reorder_ordered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    return {
      error: /reorder_ordered_at|column|schema cache/i.test(error.message)
        ? 'Could not mark ordered. Refresh and try again, or contact support.'
        : error.message,
    };
  }
  revalidatePath('/dashboard/inventory');
  return { success: 'Marked ordered' };
}

export async function deleteInventoryItem(id: string): Promise<ActionState> {
  const { supabase } = await requireOffice();
  const { error } = await supabase.from('inventory_items').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/dashboard/inventory');
  return { success: 'Deleted' };
}

/** Deduct qty from truck stock when used on a job. */
export async function deductInventory(
  itemId: string,
  qty: number
): Promise<ActionState> {
  const { supabase } = await requireOffice();
  if (qty <= 0) return { error: 'Qty must be positive' };

  const { data: item } = await supabase
    .from('inventory_items')
    .select('id, qty_on_hand, name')
    .eq('id', itemId)
    .maybeSingle();

  if (!item) return { error: 'Item not found' };
  const next = Math.max(0, Number(item.qty_on_hand) - qty);

  const { error } = await supabase
    .from('inventory_items')
    .update({ qty_on_hand: next, updated_at: new Date().toISOString() })
    .eq('id', itemId);

  if (error) return { error: error.message };
  revalidatePath('/dashboard/inventory');
  return {
    success: `Deducted ${qty} from ${item.name} (now ${next})`,
  };
}
