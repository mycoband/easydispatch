'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createEquipment,
  deleteEquipment,
  linkEquipmentToJob,
  updateEquipment,
  type ActionState,
} from '@/app/dashboard/customers/actions';
import { EquipmentForm } from '@/components/equipment/EquipmentForm';
import { PlateScanPanel } from '@/components/equipment/PlateScanPanel';
import { WarrantyBadge } from '@/components/equipment/WarrantyBadge';

type Equipment = {
  id: string;
  name: string | null;
  equipment_type: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  capacity: string | null;
  electrical: string | null;
  refrigerant: string | null;
  filter_size: string | null;
  filter_qty: number | null;
  install_date: string | null;
  property_id?: string | null;
  warranty_parts_expires?: string | null;
  warranty_labor_expires?: string | null;
  warranty_notes?: string | null;
  notes: string | null;
  photo_url: string | null;
};

export function EquipmentSection({
  customerId,
  equipment,
  jobId,
  selectedEquipmentId,
  properties = [],
}: {
  customerId: string;
  equipment: Equipment[];
  /** When set, scanning/adding can link the unit to this job. */
  jobId?: string | null;
  selectedEquipmentId?: string | null;
  properties?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const addAction = createEquipment.bind(null, customerId);

  async function onDelete(equipmentId: string) {
    if (!confirm('Remove this equipment from the property?')) return;
    const result = await deleteEquipment(customerId, equipmentId);
    setMessage(result.error || result.success || null);
    setEditingId(null);
  }

  async function onLink(equipmentId: string) {
    if (!jobId) return;
    setLinkingId(equipmentId);
    const result = await linkEquipmentToJob(jobId, equipmentId);
    setMessage(result.error || result.success || null);
    setLinkingId(null);
    router.refresh();
  }

  return (
    <section className="panel p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            Equipment
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            {jobId
              ? 'Units on this property — scan a data plate to add, or link one to this job.'
              : 'Property equipment profile — scan a data plate or add manually.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!scanning && (
            <button
              type="button"
              onClick={() => {
                setScanning(true);
                setAdding(false);
                setEditingId(null);
              }}
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Scan data plate
            </button>
          )}
          {!adding && (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setScanning(false);
                setEditingId(null);
              }}
              className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50"
            >
              Add manually
            </button>
          )}
        </div>
      </div>

      {message && (
        <p className="mb-3 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">
          {message}
        </p>
      )}

      {scanning && (
        <PlateScanPanel
          customerId={customerId}
          jobId={jobId}
          onClose={() => setScanning(false)}
        />
      )}

      {adding && (
        <div className="mb-4">
          <EquipmentForm
            action={async (prev, formData) => {
              if (jobId) formData.set('job_id', jobId);
              const result = await addAction(prev, formData);
              if (result.success) {
                setAdding(false);
                router.refresh();
              }
              return result;
            }}
            submitLabel={jobId ? 'Add & link to job' : 'Add equipment'}
            onCancel={() => setAdding(false)}
            properties={properties}
          />
        </div>
      )}

      {equipment.length === 0 && !adding && !scanning ? (
        <p className="rounded-lg border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-500">
          No equipment yet. Scan a nameplate or add an RTU / furnace manually.
        </p>
      ) : (
        <ul className="space-y-3">
          {equipment.map((item) => {
            const editAction = updateEquipment.bind(null, customerId, item.id) as (
              prev: ActionState,
              formData: FormData
            ) => Promise<ActionState>;

            return (
              <li
                key={item.id}
                className="rounded-xl border border-ink-200 bg-white p-4"
              >
                {editingId === item.id ? (
                  <EquipmentForm
                    action={async (prev, formData) => {
                      if (jobId) formData.set('job_id', jobId);
                      const result = await editAction(prev, formData);
                      if (result.success) {
                        setEditingId(null);
                        router.refresh();
                      }
                      return result;
                    }}
                    initial={item}
                    submitLabel="Save equipment"
                    onCancel={() => setEditingId(null)}
                    properties={properties}
                  />
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 gap-3">
                      {item.photo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.photo_url}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-lg border border-ink-200 object-cover"
                        />
                      )}
                      <div className="min-w-0 space-y-2">
                        <div>
                          <p className="font-medium text-ink-900">
                            {item.name?.trim() ||
                              item.equipment_type ||
                              'Equipment'}
                            {item.name?.trim() && item.equipment_type
                              ? ` · ${item.equipment_type}`
                              : ''}
                            {item.manufacturer ? ` · ${item.manufacturer}` : ''}
                            {item.model ? ` ${item.model}` : ''}
                          </p>
                          <p className="mt-1 text-sm text-ink-500">
                            {[
                              item.serial_number && `S/N ${item.serial_number}`,
                              item.capacity,
                              item.electrical,
                              item.refrigerant,
                              item.filter_size &&
                                `Filter ${item.filter_size}${
                                  item.filter_qty != null
                                    ? ` × ${item.filter_qty}`
                                    : ''
                                }`,
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'No specs yet'}
                          </p>
                          {item.notes && (
                            <p className="mt-2 text-sm text-ink-600">
                              {item.notes}
                            </p>
                          )}
                        </div>
                        <WarrantyBadge info={item} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {jobId && (
                        <button
                          type="button"
                          disabled={
                            selectedEquipmentId === item.id ||
                            linkingId === item.id
                          }
                          onClick={() => onLink(item.id)}
                          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                            selectedEquipmentId === item.id
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'border border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100'
                          }`}
                        >
                          {selectedEquipmentId === item.id
                            ? 'On this job'
                            : linkingId === item.id
                              ? 'Linking…'
                              : 'Use on job'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(item.id);
                          setAdding(false);
                          setScanning(false);
                        }}
                        className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
