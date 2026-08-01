'use server';

import { revalidatePath } from 'next/cache';
import { requireOffice } from '@/lib/auth';
import { parsePricebookCsv } from '@/lib/pricebook/csv-import';

export type ImportPricebookResult = {
  error?: string;
  success?: string;
  created?: number;
  updated?: number;
  skipped?: number;
  failed?: number;
  errors?: { line: number; message: string }[];
};

export type DuplicateMode = 'skip' | 'update' | 'create';

export async function importPricebookFromCsv(
  csvText: string,
  duplicateMode: DuplicateMode = 'skip'
): Promise<ImportPricebookResult> {
  try {
    const { supabase } = await requireOffice();
    const parsed = parsePricebookCsv(csvText);
    if (parsed.error) return { error: parsed.error };

    const valid = parsed.rows.filter((r) => r.data);
    const invalid = parsed.rows.filter((r) => !r.data);

    if (!valid.length) {
      return {
        error: 'No valid rows to import',
        failed: invalid.length,
        errors: invalid.slice(0, 20).map((r) => ({
          line: r.line,
          message: r.error || 'Invalid',
        })),
      };
    }

    const { data: existing } = await supabase
      .from('pricebook_items')
      .select('id, name, category');

    const known = (existing ?? []).map((e) => ({
      id: e.id as string,
      name: (e.name || '').trim().toLowerCase(),
      category: (e.category || '').trim().toLowerCase(),
    }));

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { line: number; message: string }[] = invalid.map((r) => ({
      line: r.line,
      message: r.error || 'Invalid',
    }));

    for (const row of valid) {
      const data = row.data!;
      const nameKey = data.name.trim().toLowerCase();
      const catKey = data.category.trim().toLowerCase();
      const match =
        known.find((k) => k.name === nameKey && k.category === catKey) ||
        known.find((k) => k.name === nameKey);

      const payload = {
        name: data.name,
        description: data.description,
        category: data.category,
        unit_price: data.unit_price,
        taxable: data.taxable,
        active: data.active,
        sort_order: data.sort_order,
        updated_at: new Date().toISOString(),
      };

      try {
        if (match) {
          if (duplicateMode === 'skip') {
            skipped++;
            continue;
          }
          if (duplicateMode === 'update') {
            const { error } = await supabase
              .from('pricebook_items')
              .update(payload)
              .eq('id', match.id);
            if (error) {
              errors.push({ line: row.line, message: error.message });
              continue;
            }
            updated++;
            continue;
          }
        }

        const { data: inserted, error } = await supabase
          .from('pricebook_items')
          .insert(payload)
          .select('id')
          .single();

        if (error || !inserted) {
          errors.push({
            line: row.line,
            message: error?.message || 'Insert failed',
          });
          continue;
        }

        known.push({
          id: inserted.id,
          name: nameKey,
          category: catKey,
        });
        created++;
      } catch (err) {
        errors.push({
          line: row.line,
          message: err instanceof Error ? err.message : 'Row failed',
        });
      }
    }

    revalidatePath('/dashboard/pricebook');
    revalidatePath('/dashboard/estimates');
    revalidatePath('/dashboard/jobs');

    return {
      success: `Import finished: ${created} created, ${updated} updated, ${skipped} skipped, ${errors.length} failed`,
      created,
      updated,
      skipped,
      failed: errors.length,
      errors: errors.slice(0, 40),
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Import failed',
    };
  }
}
