'use server';

import { revalidatePath } from 'next/cache';
import { requireOffice } from '@/lib/auth';
import {
  digitsOnly,
  isJunkCustomerName,
  namesLikelySame,
  type ImportRow,
  type ImportSite,
} from '@/lib/customers/csv-import';
import { emptyToNull } from '@/lib/validations/customer';

export type ImportCustomersResult = {
  error?: string;
  success?: string;
  created?: number;
  updated?: number;
  skipped?: number;
  failed?: number;
  errors?: { line: number; message: string }[];
  /** Sample of duplicate skips (why a row was not created). */
  skippedSamples?: { line: number; name: string; reason: string }[];
};

export type DuplicateMode = 'skip' | 'update' | 'create';

export type ImportBatchRow = ImportRow & { line: number };

type KnownCustomer = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};

type MatchIndexes = {
  byPhone: Map<string, KnownCustomer>;
  byEmail: Map<string, KnownCustomer>;
  byNameAddr: Map<string, KnownCustomer>;
};

const EXISTING_PAGE = 1000;
/** Keep each request under Vercel timeouts. Must match client batching. */
const IMPORT_BATCH_SIZE = 150;

function nameAddrKey(name?: string | null, address?: string | null) {
  return `${(name || '').trim().toLowerCase()}|${(address || '').trim().toLowerCase()}`;
}

function buildIndexes(known: KnownCustomer[]): MatchIndexes {
  const byPhone = new Map<string, KnownCustomer>();
  const byEmail = new Map<string, KnownCustomer>();
  const byNameAddr = new Map<string, KnownCustomer>();

  for (const c of known) {
    const phone = digitsOnly(c.phone);
    if (phone.length >= 7 && !byPhone.has(phone)) byPhone.set(phone, c);

    const email = (c.email || '').trim().toLowerCase();
    if (email && !byEmail.has(email)) byEmail.set(email, c);

    const key = nameAddrKey(c.name, c.address);
    if (key !== '|' && !byNameAddr.has(key)) byNameAddr.set(key, c);
  }

  return { byPhone, byEmail, byNameAddr };
}

function findMatch(
  row: ImportRow,
  indexes: MatchIndexes
): { customer: KnownCustomer; reason: string } | null {
  const phone = digitsOnly(row.phone);
  if (phone.length >= 7) {
    const hit = indexes.byPhone.get(phone);
    if (hit) {
      return {
        customer: hit,
        reason: `same phone as “${hit.name || 'existing customer'}”`,
      };
    }
  }
  const email = row.email.trim().toLowerCase();
  if (email) {
    const hit = indexes.byEmail.get(email);
    // Require similar names — shared shop/AP emails must not collapse accounts
    if (hit && namesLikelySame(row.name, hit.name)) {
      return {
        customer: hit,
        reason: `same email + name as “${hit.name || 'existing customer'}”`,
      };
    }
  }
  const key = nameAddrKey(row.name, row.address);
  if (key !== '|') {
    const hit = indexes.byNameAddr.get(key);
    if (hit) {
      return {
        customer: hit,
        reason: `same name + address as “${hit.name || 'existing customer'}”`,
      };
    }
  }
  return null;
}

function remember(indexes: MatchIndexes, customer: KnownCustomer) {
  const phone = digitsOnly(customer.phone);
  if (phone.length >= 7 && !indexes.byPhone.has(phone)) {
    indexes.byPhone.set(phone, customer);
  }
  const email = (customer.email || '').trim().toLowerCase();
  if (email && !indexes.byEmail.has(email)) {
    indexes.byEmail.set(email, customer);
  }
  const key = nameAddrKey(customer.name, customer.address);
  if (key !== '|' && !indexes.byNameAddr.has(key)) {
    indexes.byNameAddr.set(key, customer);
  }
}

async function loadExistingCustomers(
  supabase: Awaited<ReturnType<typeof requireOffice>>['supabase'],
  companyId: string
): Promise<KnownCustomer[]> {
  const known: KnownCustomer[] = [];
  for (let from = 0; ; from += EXISTING_PAGE) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, phone, email, address')
      .eq('company_id', companyId)
      .order('id', { ascending: true })
      .range(from, from + EXISTING_PAGE - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;
    known.push(...data);
    if (data.length < EXISTING_PAGE) break;
  }
  return known;
}

function toPayload(companyId: string, data: ImportRow) {
  return {
    company_id: companyId,
    name: data.name,
    address: emptyToNull(data.address),
    city: emptyToNull(data.city),
    state: emptyToNull(data.state) || null,
    zip: emptyToNull(data.zip),
    phone: emptyToNull(data.phone),
    email: emptyToNull(data.email),
    notes: emptyToNull(data.notes),
    access_notes: emptyToNull(data.access_notes),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Import one chunk of already-parsed customer rows.
 * Call repeatedly from the client for large CSVs (3000+).
 */
export async function importCustomerBatch(
  rows: ImportBatchRow[],
  duplicateMode: DuplicateMode = 'skip',
  options?: { finalize?: boolean }
): Promise<ImportCustomersResult> {
  try {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { error: 'No rows in this batch' };
    }
    if (rows.length > IMPORT_BATCH_SIZE) {
      return {
        error: `Batch too large (max ${IMPORT_BATCH_SIZE}). Refresh and try again.`,
      };
    }

    const { supabase, profile } = await requireOffice();
    if (!profile.company_id) {
      return {
        error:
          'Your account is not linked to a company yet. Sign out and back in, then try import again.',
      };
    }
    const companyId = profile.company_id;
    const existing = await loadExistingCustomers(supabase, companyId);
    const indexes = buildIndexes(existing);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { line: number; message: string }[] = [];
    const skippedSamples: { line: number; name: string; reason: string }[] = [];

    const toCreate: { row: ImportBatchRow; payload: ReturnType<typeof toPayload> }[] =
      [];
    const toUpdate: {
      row: ImportBatchRow;
      id: string;
      payload: ReturnType<typeof toPayload>;
    }[] = [];

    for (const row of rows) {
      if (!row?.name?.trim()) {
        errors.push({ line: row?.line || 0, message: 'Name is required' });
        continue;
      }

      const match = findMatch(row, indexes);
      const payload = toPayload(companyId, row);

      if (match) {
        // Same-batch duplicate of a row we are about to insert
        if (match.customer.id.startsWith('pending:')) {
          skipped++;
          if (skippedSamples.length < 25) {
            skippedSamples.push({
              line: row.line,
              name: row.name,
              reason: match.reason,
            });
          }
          continue;
        }
        if (duplicateMode === 'skip') {
          skipped++;
          if (skippedSamples.length < 25) {
            skippedSamples.push({
              line: row.line,
              name: row.name,
              reason: match.reason,
            });
          }
          continue;
        }
        if (duplicateMode === 'update') {
          toUpdate.push({ row, id: match.customer.id, payload });
          remember(indexes, {
            id: match.customer.id,
            name: payload.name,
            phone: payload.phone,
            email: payload.email,
            address: payload.address,
          });
          continue;
        }
        // create anyway — fall through
      }

      // Reserve keys so duplicates later in this same batch are skipped/matched
      remember(indexes, {
        id: `pending:${row.line}`,
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        address: payload.address,
      });
      toCreate.push({ row, payload });
    }

    // Bulk insert customers, then matching primary properties
    const INSERT_CHUNK = 100;
    for (let i = 0; i < toCreate.length; i += INSERT_CHUNK) {
      const slice = toCreate.slice(i, i + INSERT_CHUNK);
      const { data: inserted, error } = await supabase
        .from('customers')
        .insert(slice.map((s) => s.payload))
        .select('id, name, phone, email, address');

      if (error || !inserted) {
        for (const s of slice) {
          errors.push({
            line: s.row.line,
            message: error?.message || 'Insert failed',
          });
        }
        continue;
      }

      if (inserted.length !== slice.length) {
        // Partial / unexpected — count what we got, flag remainder
        for (let j = inserted.length; j < slice.length; j++) {
          errors.push({
            line: slice[j].row.line,
            message: 'Insert returned fewer rows than expected',
          });
        }
      }

      const propertyRows = inserted.flatMap((customer, idx) => {
        const src = slice[idx];
        remember(indexes, customer);
        const sites: ImportSite[] =
          src.row.sites?.length > 0
            ? src.row.sites
            : [
                {
                  name: src.row.site_name?.trim() || 'Primary',
                  address: src.payload.address || '',
                  city: src.payload.city || '',
                  state: src.payload.state || '',
                  zip: src.payload.zip || '',
                  access_notes: src.payload.access_notes || '',
                  is_primary: true,
                },
              ];

        return sites.map((site) => ({
          company_id: companyId,
          customer_id: customer.id,
          name: site.name?.trim() || 'Primary',
          address: emptyToNull(site.address),
          city: emptyToNull(site.city),
          state: emptyToNull(site.state),
          zip: emptyToNull(site.zip),
          access_notes: emptyToNull(site.access_notes),
          is_primary: Boolean(site.is_primary),
        }));
      });

      // Bulk insert sites (some HCP customers have many addresses)
      for (let p = 0; p < propertyRows.length; p += 100) {
        const propSlice = propertyRows.slice(p, p + 100);
        const { error: propError } = await supabase
          .from('properties')
          .insert(propSlice);
        if (propError) {
          for (const s of slice.slice(0, inserted.length)) {
            errors.push({
              line: s.row.line,
              message: `Customer saved, site failed: ${propError.message}`,
            });
          }
          break;
        }
      }

      created += inserted.length;
    }

    // Updates (smaller volume usually) — parallel small groups
    const UPDATE_CHUNK = 25;
    for (let i = 0; i < toUpdate.length; i += UPDATE_CHUNK) {
      const slice = toUpdate.slice(i, i + UPDATE_CHUNK);
      const results = await Promise.all(
        slice.map(async ({ row, id, payload }) => {
          const { error } = await supabase
            .from('customers')
            .update(payload)
            .eq('id', id)
            .eq('company_id', companyId);
          if (error) {
            return { ok: false as const, line: row.line, message: error.message };
          }
          await supabase
            .from('properties')
            .update({
              address: payload.address,
              city: payload.city,
              state: payload.state,
              zip: payload.zip,
              access_notes: payload.access_notes,
              updated_at: new Date().toISOString(),
            })
            .eq('customer_id', id)
            .eq('is_primary', true);
          return { ok: true as const };
        })
      );

      for (const r of results) {
        if (r.ok) updated++;
        else errors.push({ line: r.line, message: r.message });
      }
    }

    if (options?.finalize) {
      revalidatePath('/dashboard/customers');
      revalidatePath('/dashboard');
    }

    return {
      created,
      updated,
      skipped,
      failed: errors.length,
      errors: errors.slice(0, 20),
      skippedSamples: skippedSamples.slice(0, 25),
      success: `Batch: ${created} created, ${updated} updated, ${skipped} skipped, ${errors.length} failed`,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Import failed',
    };
  }
}

export type CleanupResult = {
  error?: string;
  success?: string;
  deleted?: number;
  kept?: number;
  skippedWithJobs?: number;
};

async function loadCompanyCustomerIds(
  supabase: Awaited<ReturnType<typeof requireOffice>>['supabase'],
  companyId: string
) {
  const all: { id: string; name: string | null }[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name')
      .eq('company_id', companyId)
      .order('id', { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < page) break;
  }
  return all;
}

async function customerIdsWithJobs(
  supabase: Awaited<ReturnType<typeof requireOffice>>['supabase'],
  customerIds: string[]
) {
  const withJobs = new Set<string>();
  const chunk = 200;
  for (let i = 0; i < customerIds.length; i += chunk) {
    const slice = customerIds.slice(i, i + chunk);
    const { data, error } = await supabase
      .from('jobs')
      .select('customer_id')
      .in('customer_id', slice);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (row.customer_id) withJobs.add(row.customer_id);
    }
  }
  return withJobs;
}

/**
 * Prep related rows so customer delete can cascade cleanly.
 * jobs.equipment_id has no ON DELETE SET NULL, so cascading equipment deletes
 * fail when any job still points at those units.
 */
async function prepareCustomerDeletes(
  supabase: Awaited<ReturnType<typeof requireOffice>>['supabase'],
  customerIds: string[]
) {
  const chunk = 100;
  for (let i = 0; i < customerIds.length; i += chunk) {
    const slice = customerIds.slice(i, i + chunk);

    const { data: equipment, error: eqErr } = await supabase
      .from('equipment')
      .select('id')
      .in('customer_id', slice);
    if (eqErr) throw new Error(eqErr.message);
    const equipmentIds = (equipment ?? []).map((e) => e.id);

    for (let j = 0; j < equipmentIds.length; j += chunk) {
      const eqSlice = equipmentIds.slice(j, j + chunk);
      const { error: jobErr } = await supabase
        .from('jobs')
        .update({ equipment_id: null })
        .in('equipment_id', eqSlice);
      if (jobErr) throw new Error(jobErr.message);
    }

    // Optional FKs without cascade — unlink / remove so wipe isn't blocked
    const { error: estErr } = await supabase
      .from('estimates')
      .update({ customer_id: null })
      .in('customer_id', slice);
    if (estErr && !/does not exist|schema cache/i.test(estErr.message)) {
      throw new Error(estErr.message);
    }

    const { error: agrErr } = await supabase
      .from('service_agreements')
      .delete()
      .in('customer_id', slice);
    if (agrErr && !/does not exist|schema cache/i.test(agrErr.message)) {
      throw new Error(agrErr.message);
    }
  }
}

async function deleteCustomerIds(
  supabase: Awaited<ReturnType<typeof requireOffice>>['supabase'],
  companyId: string,
  ids: string[]
) {
  await prepareCustomerDeletes(supabase, ids);

  let deleted = 0;
  const chunk = 50;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { error, count } = await supabase
      .from('customers')
      .delete({ count: 'exact' })
      .eq('company_id', companyId)
      .in('id', slice);
    if (error) throw new Error(error.message);
    deleted += count ?? slice.length;
  }
  return deleted;
}

/** Remove already-imported customers whose name is only a phone number / digits. */
export async function deleteJunkCustomers(): Promise<CleanupResult> {
  try {
    const { supabase, profile } = await requireOffice();
    if (!profile.company_id) {
      return { error: 'Your account is not linked to a company yet.' };
    }
    const companyId = profile.company_id;
    const customers = await loadCompanyCustomerIds(supabase, companyId);
    const junk = customers.filter((c) => isJunkCustomerName(c.name || ''));
    if (!junk.length) {
      return {
        success: 'No junk/false customers found.',
        deleted: 0,
        kept: customers.length,
      };
    }

    const withJobs = await customerIdsWithJobs(
      supabase,
      junk.map((c) => c.id)
    );
    const removable = junk.filter((c) => !withJobs.has(c.id)).map((c) => c.id);
    const skippedWithJobs = junk.length - removable.length;

    const deleted = removable.length
      ? await deleteCustomerIds(supabase, companyId, removable)
      : 0;

    revalidatePath('/dashboard/customers');
    revalidatePath('/dashboard');

    return {
      success: `Removed ${deleted} junk/false customers${
        skippedWithJobs
          ? ` (${skippedWithJobs} kept because they have jobs linked)`
          : ''
      }.`,
      deleted,
      kept: customers.length - deleted,
      skippedWithJobs,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Cleanup failed',
    };
  }
}

/**
 * Wipe customers that have no jobs, so a CSV can be re-imported cleanly.
 * Customers with jobs are kept (jobs need a customer record).
 */
export async function wipeCustomersWithoutJobs(): Promise<CleanupResult> {
  try {
    const { supabase, profile } = await requireOffice();
    if (!profile.company_id) {
      return { error: 'Your account is not linked to a company yet.' };
    }
    const companyId = profile.company_id;
    const customers = await loadCompanyCustomerIds(supabase, companyId);
    if (!customers.length) {
      return {
        success: 'Customer list was already empty.',
        deleted: 0,
        kept: 0,
      };
    }

    const withJobs = await customerIdsWithJobs(
      supabase,
      customers.map((c) => c.id)
    );
    const removable = customers
      .filter((c) => !withJobs.has(c.id))
      .map((c) => c.id);
    const skippedWithJobs = customers.length - removable.length;

    const deleted = removable.length
      ? await deleteCustomerIds(supabase, companyId, removable)
      : 0;

    revalidatePath('/dashboard/customers');
    revalidatePath('/dashboard');

    return {
      success: `Removed ${deleted} customers. ${skippedWithJobs} kept (have jobs). You can import your CSV now.`,
      deleted,
      kept: skippedWithJobs,
      skippedWithJobs,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Wipe failed',
    };
  }
}
