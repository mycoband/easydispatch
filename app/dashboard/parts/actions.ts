'use server';

import { revalidatePath } from 'next/cache';
import { requireOffice } from '@/lib/auth';
import {
  PART_ORDER_STATUSES,
  type PartOrderStatus,
} from '@/lib/jobs/part-orders';
import { updatePartOrderStatus } from '@/app/dashboard/jobs/parts-actions';

export type PartsBoardState = { error?: string; success?: string };

export async function advancePartFromBoard(
  jobId: string,
  orderId: string,
  status: PartOrderStatus
): Promise<PartsBoardState> {
  return updatePartOrderStatus(jobId, orderId, status);
}

/** Mark received (if needed) and add qty to inventory. */
export async function receivePartIntoInventory(
  jobId: string,
  orderId: string,
  input: {
    inventoryItemId?: string;
    createName?: string;
    sku?: string;
    qty?: number;
    cost?: number;
    location?: string;
  }
): Promise<PartsBoardState> {
  try {
    const { supabase } = await requireOffice();
    const qty = input.qty && input.qty > 0 ? input.qty : 1;

    const { data: order, error: orderErr } = await supabase
      .from('job_part_orders')
      .select('*')
      .eq('id', orderId)
      .eq('job_id', jobId)
      .maybeSingle();

    if (orderErr || !order) {
      return { error: orderErr?.message || 'Part order not found' };
    }

    if (input.inventoryItemId) {
      const { data: item } = await supabase
        .from('inventory_items')
        .select('id, qty_on_hand, name')
        .eq('id', input.inventoryItemId)
        .maybeSingle();
      if (!item) return { error: 'Inventory item not found' };

      const { error } = await supabase
        .from('inventory_items')
        .update({
          qty_on_hand: Number(item.qty_on_hand) + qty,
          cost: input.cost ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
      if (error) return { error: error.message };
    } else {
      const name = (input.createName || order.description || '').trim();
      if (!name) return { error: 'Name required to create stock item' };

      const { error } = await supabase.from('inventory_items').insert({
        name,
        sku: input.sku?.trim() || order.sku || null,
        qty_on_hand: qty,
        min_qty: 1,
        cost: input.cost ?? (Number(order.unit_cost) || 0),
        sell_price: 0,
        location: input.location?.trim() || 'Warehouse',
      });
      if (error) return { error: error.message };
    }

    if (order.status !== 'received' && order.status !== 'installed') {
      const status: PartOrderStatus = 'received';
      if (PART_ORDER_STATUSES.includes(status)) {
        await supabase
          .from('job_part_orders')
          .update({
            status,
            received_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);
      }
    }

    revalidatePath('/dashboard/parts');
    revalidatePath('/dashboard/inventory');
    revalidatePath(`/dashboard/jobs/${jobId}`);
    revalidatePath(`/tech/jobs/${jobId}`);

    return { success: `Added ${qty} to inventory` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Receive failed' };
  }
}
