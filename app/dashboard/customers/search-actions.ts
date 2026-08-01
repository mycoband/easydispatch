'use server';

import { requireOffice } from '@/lib/auth';

export type CustomerSearchHit = {
  id: string;
  name: string;
  city: string | null;
  phone: string | null;
};

export type CustomerJobOptions = {
  properties: { id: string; name: string; label: string }[];
  equipment: {
    id: string;
    name: string | null;
    equipment_type: string | null;
  }[];
};

/** Typeahead search across the full customer list (not capped by a preload). */
export async function searchCustomers(
  query: string,
  limit = 25
): Promise<CustomerSearchHit[]> {
  const { supabase, profile } = await requireOffice();
  const q = query.trim().replace(/[%_,]/g, '');
  const take = Math.min(Math.max(limit, 1), 50);

  let request = supabase
    .from('customers')
    .select('id, name, city, phone')
    .order('name', { ascending: true })
    .limit(take);

  if (profile.company_id) {
    request = request.eq('company_id', profile.company_id);
  }

  if (q) {
    request = request.or(
      `name.ilike.%${q}%,city.ilike.%${q}%,phone.ilike.%${q}%,address.ilike.%${q}%`
    );
  }

  const { data } = await request;
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    city: c.city,
    phone: c.phone,
  }));
}

export async function loadCustomerJobOptions(
  customerId: string
): Promise<CustomerJobOptions> {
  const { supabase } = await requireOffice();
  if (!customerId) return { properties: [], equipment: [] };

  const [{ data: properties }, { data: equipment }] = await Promise.all([
    supabase
      .from('properties')
      .select('id, name, address, city, is_primary')
      .eq('customer_id', customerId)
      .order('is_primary', { ascending: false })
      .order('name'),
    supabase
      .from('equipment')
      .select('id, name, equipment_type')
      .eq('customer_id', customerId)
      .order('name', { ascending: true }),
  ]);

  return {
    properties: (properties ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      label: [p.name, p.address, p.city].filter(Boolean).join(' · '),
    })),
    equipment: (equipment ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      equipment_type: e.equipment_type,
    })),
  };
}
