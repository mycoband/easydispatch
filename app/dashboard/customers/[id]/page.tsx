import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateCustomer } from '@/app/dashboard/customers/actions';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { DeleteCustomerButton } from '@/components/customers/DeleteCustomerButton';
import { EquipmentHistory } from '@/components/equipment/EquipmentHistory';
import { EquipmentSection } from '@/components/equipment/EquipmentSection';
import { EquipmentTimeline } from '@/components/equipment/EquipmentTimeline';
import { CreatePortalLinkButton } from '@/components/portal/CreatePortalLinkButton';
import { PropertiesSection } from '@/components/properties/PropertiesSection';
import { requireOffice } from '@/lib/auth';
import { loadCompanySettings } from '@/lib/company';
import { formatAddress } from '@/lib/utils';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ supabase }, company] = await Promise.all([
    requireOffice(),
    loadCompanySettings(),
  ]);
  const showTimeline = Boolean(company.modules.equipment_timeline);
  const showPortal = Boolean(company.modules.portal);

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!customer) notFound();

  const [{ data: equipment }, { data: historyJobs }, propsRes] =
    await Promise.all([
      supabase
        .from('equipment')
        .select(
          'id, name, equipment_type, manufacturer, model, serial_number, capacity, electrical, refrigerant, filter_size, filter_qty, install_date, notes, photo_url, property_id, warranty_parts_expires, warranty_labor_expires, warranty_notes, pm_checklist'
        )
        .eq('customer_id', id)
        .order('created_at', { ascending: true })
        .then(async (res) => {
          if (
            res.error &&
            /pm_checklist|column|schema cache/i.test(res.error.message)
          ) {
            return supabase
              .from('equipment')
              .select(
                'id, name, equipment_type, manufacturer, model, serial_number, capacity, electrical, refrigerant, filter_size, filter_qty, install_date, notes, photo_url, property_id, warranty_parts_expires, warranty_labor_expires, warranty_notes'
              )
              .eq('customer_id', id)
              .order('created_at', { ascending: true });
          }
          return res;
        }),
      supabase
        .from('jobs')
        .select(
          'id, job_number, job_type, status, diagnosis, scheduled_start, created_at, total, equipment_id, is_callback'
        )
        .eq('customer_id', id)
        .neq('status', 'Cancelled')
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('properties')
        .select(
          'id, name, address, city, state, zip, access_notes, gate_code, lockbox_code, notes, is_primary'
        )
        .eq('customer_id', id)
        .order('is_primary', { ascending: false })
        .order('name'),
    ]);

  const properties = propsRes.error ? [] : propsRes.data ?? [];
  const updateAction = updateCustomer.bind(null, id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/customers"
            className="text-sm font-medium text-ink-500 hover:text-ink-800"
          >
            ← Customers
          </Link>
          <h1 className="mt-2 font-display text-2xl font-semibold text-ink-950">
            {customer.name}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {formatAddress(customer) || 'No address on file'}
            {customer.phone ? ` · ${customer.phone}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showPortal && (
            <CreatePortalLinkButton
              purpose="customer"
              customerId={customer.id}
              label="Customer portal link"
            />
          )}
          <Link
            href={`/dashboard/estimates/new?customerId=${customer.id}`}
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50"
          >
            New estimate
          </Link>
          <Link
            href={`/dashboard/jobs/new?customerId=${customer.id}`}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            New job
          </Link>
          <DeleteCustomerButton customerId={customer.id} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="panel p-5">
          <h2 className="mb-4 font-display text-lg font-semibold text-ink-950">
            Contact
          </h2>
          <CustomerForm
            action={updateAction}
            initial={customer}
            submitLabel="Save changes"
          />
        </section>

        <PropertiesSection customerId={customer.id} properties={properties} />
      </div>

      <EquipmentSection
        customerId={customer.id}
        equipment={equipment ?? []}
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
      />

      {showTimeline ? (
        <EquipmentTimeline
          customerId={customer.id}
          equipment={(equipment ?? []).map((e) => ({
            id: e.id,
            name: e.name,
            equipment_type: e.equipment_type,
            manufacturer: e.manufacturer,
            model: e.model,
            serial_number: e.serial_number,
            pm_checklist: (e as { pm_checklist?: unknown }).pm_checklist,
          }))}
          jobs={historyJobs ?? []}
        />
      ) : (
        <EquipmentHistory
          jobs={historyJobs ?? []}
          equipment={(equipment ?? []).map((e) => ({
            id: e.id,
            name: e.name,
            equipment_type: e.equipment_type,
          }))}
        />
      )}
    </div>
  );
}
