import type { createClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Load techs/tax rates always.
 * Customers are searched via CustomerSearchSelect (full list can be 3000+).
 * Equipment/properties: scoped to one customer when provided, otherwise empty
 * (JobForm loads them when a customer is picked).
 */
export async function loadJobFormOptions(
  supabase: Supabase,
  opts?: { customerId?: string | null }
) {
  const customerId = opts?.customerId || null;

  const [
    { data: techs },
    { data: taxRates },
    equipmentRes,
    propsRes,
    customerRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role, skills')
      .in('role', ['technician', 'owner', 'dispatcher'])
      .order('full_name', { ascending: true }),
    supabase
      .from('tax_rates')
      .select('id, name, rate')
      .order('name', { ascending: true }),
    customerId
      ? supabase
          .from('equipment')
          .select('id, customer_id, name, equipment_type, property_id')
          .eq('customer_id', customerId)
          .order('name', { ascending: true })
      : Promise.resolve({ data: [] as { id: string; customer_id: string | null; name: string | null; equipment_type: string | null }[] }),
    customerId
      ? supabase
          .from('properties')
          .select('id, customer_id, name, address, city, is_primary')
          .eq('customer_id', customerId)
          .order('is_primary', { ascending: false })
          .order('name')
      : Promise.resolve({ data: [] as { id: string; customer_id: string | null; name: string; address: string | null; city: string | null; is_primary: boolean | null }[], error: null }),
    customerId
      ? supabase
          .from('customers')
          .select('id, name')
          .eq('id', customerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const equipmentByCustomer: Record<
    string,
    { id: string; name: string | null; equipment_type: string | null }[]
  > = {};

  for (const eq of equipmentRes.data ?? []) {
    if (!eq.customer_id) continue;
    if (!equipmentByCustomer[eq.customer_id]) {
      equipmentByCustomer[eq.customer_id] = [];
    }
    equipmentByCustomer[eq.customer_id].push({
      id: eq.id,
      name: eq.name,
      equipment_type: eq.equipment_type,
    });
  }

  const propertiesByCustomer: Record<
    string,
    { id: string; name: string; label: string }[]
  > = {};
  const props =
    'error' in propsRes && propsRes.error ? [] : propsRes.data ?? [];
  for (const p of props) {
    if (!p.customer_id) continue;
    if (!propertiesByCustomer[p.customer_id]) {
      propertiesByCustomer[p.customer_id] = [];
    }
    propertiesByCustomer[p.customer_id].push({
      id: p.id,
      name: p.name,
      label: [p.name, p.address, p.city].filter(Boolean).join(' · '),
    });
  }

  const customers = customerRes.data
    ? [{ id: customerRes.data.id, name: customerRes.data.name }]
    : [];

  return {
    customers,
    equipmentByCustomer,
    propertiesByCustomer,
    techs: (techs ?? []).map((t) => ({
      id: t.id,
      full_name: t.full_name,
      skills: Array.isArray(t.skills) ? (t.skills as string[]) : [],
    })),
    taxRates: taxRates ?? [],
  };
}
