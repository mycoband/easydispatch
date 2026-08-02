'use client';

import { useActionState, useEffect, useState } from 'react';
import type { ActionState } from '@/app/dashboard/jobs/actions';
import { loadCustomerJobOptions } from '@/app/dashboard/customers/search-actions';
import { CustomerSearchSelect } from '@/components/customers/CustomerSearchSelect';
import { DictationField } from '@/components/ui/DictationButton';
import { HVAC_JOB_TYPES } from '@/lib/hvac/presets';
import { JOB_PRIORITIES, JOB_STATUSES } from '@/lib/validations/job';
import { toDatetimeLocalValue } from '@/lib/jobs/totals';

type Customer = { id: string; name: string };
type Equipment = { id: string; name: string | null; equipment_type: string | null };
type Property = { id: string; name: string; label: string };
type Tech = { id: string; full_name: string | null; skills?: string[] };
type TaxRate = { id: string; name: string; rate: number };

type JobValues = {
  customer_id?: string | null;
  customer_name?: string | null;
  job_number?: string | null;
  property_id?: string | null;
  equipment_id?: string | null;
  job_type?: string | null;
  priority?: string | null;
  status?: string | null;
  assigned_to?: string | null;
  diagnosis?: string | null;
  est_hours?: number | string | null;
  scheduled_start?: string | null;
  tax_rate_id?: string | null;
  notes?: string | null;
  internal_notes?: string | null;
  customer_summary?: string | null;
  is_callback?: boolean | null;
  warranty_flag?: boolean | null;
};

const initialState: ActionState = {};

function initialShowMore(quick: boolean, initial?: JobValues, force?: boolean) {
  if (!quick) return true;
  if (force) return true;
  return Boolean(
    initial?.assigned_to ||
      initial?.scheduled_start ||
      (initial?.priority && initial.priority !== 'Medium') ||
      (initial?.status && initial.status !== 'New') ||
      initial?.equipment_id ||
      initial?.est_hours ||
      initial?.internal_notes ||
      initial?.customer_summary ||
      initial?.notes ||
      initial?.is_callback ||
      initial?.warranty_flag
  );
}

export function JobForm({
  action,
  customers = [],
  equipmentByCustomer = {},
  propertiesByCustomer = {},
  techs,
  taxRates,
  initial,
  submitLabel,
  quick = false,
  forceShowMore = false,
  suggestedJobNumber,
  lockCustomer = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  customers?: Customer[];
  equipmentByCustomer?: Record<string, Equipment[]>;
  propertiesByCustomer?: Record<string, Property[]>;
  techs: Tech[];
  taxRates: TaxRate[];
  initial?: JobValues;
  submitLabel: string;
  /** Compact create flow — hide advanced fields until expanded. */
  quick?: boolean;
  /** Open More options on mount (e.g. after AI fill). */
  forceShowMore?: boolean;
  /** Prefill for new jobs (e.g. #12). Ignored when editing an existing job_number. */
  suggestedJobNumber?: string;
  /** When true (existing job), customer cannot be changed. */
  lockCustomer?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const initialCustomer =
    customers.find((c) => c.id === initial?.customer_id) ||
    (initial?.customer_id
      ? {
          id: initial.customer_id,
          name: initial.customer_name || 'Customer',
        }
      : null);

  const [customerId, setCustomerId] = useState(initialCustomer?.id || '');
  const [customerLabel, setCustomerLabel] = useState(
    initialCustomer?.name || ''
  );
  const [equipmentOptions, setEquipmentOptions] = useState<Equipment[]>(
    () =>
      (initial?.customer_id &&
        equipmentByCustomer[initial.customer_id]) ||
      []
  );
  const [propertyOptions, setPropertyOptions] = useState<Property[]>(
    () =>
      (initial?.customer_id &&
        propertiesByCustomer[initial.customer_id]) ||
      []
  );
  const [propertyId, setPropertyId] = useState(initial?.property_id || '');
  const [diagnosis, setDiagnosis] = useState(initial?.diagnosis || '');
  const [internalNotes, setInternalNotes] = useState(
    initial?.internal_notes || ''
  );
  const [customerSummary, setCustomerSummary] = useState(
    initial?.customer_summary || ''
  );
  const [notes, setNotes] = useState(initial?.notes || '');
  const [clientError, setClientError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(() =>
    initialShowMore(quick, initial, forceShowMore)
  );

  const jobNumberDefault =
    initial?.job_number || suggestedJobNumber || '';

  useEffect(() => {
    if (!customerId) {
      setEquipmentOptions([]);
      setPropertyOptions([]);
      setPropertyId('');
      return;
    }
    const cachedEquip = equipmentByCustomer[customerId];
    const cachedProps = propertiesByCustomer[customerId];

    function applyProps(props: Property[]) {
      setPropertyOptions(props);
      setPropertyId((current) => {
        if (current && props.some((p) => p.id === current)) return current;
        if (
          initial?.customer_id === customerId &&
          initial?.property_id &&
          props.some((p) => p.id === initial.property_id)
        ) {
          return initial.property_id;
        }
        return props[0]?.id || '';
      });
    }

    if (cachedEquip || cachedProps) {
      if (cachedEquip) setEquipmentOptions(cachedEquip);
      if (cachedProps) applyProps(cachedProps);
      if (cachedEquip && cachedProps) return;
    }
    let cancelled = false;
    void loadCustomerJobOptions(customerId).then((opts) => {
      if (cancelled) return;
      setEquipmentOptions(opts.equipment);
      applyProps(opts.properties);
    });
    return () => {
      cancelled = true;
    };
  }, [
    customerId,
    equipmentByCustomer,
    propertiesByCustomer,
    initial?.customer_id,
    initial?.property_id,
  ]);

  const scheduleAssignBlock = (
    <>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-700">
          Assigned tech
        </span>
        <select
          name="assigned_to"
          defaultValue={initial?.assigned_to || ''}
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
        >
          <option value="">Unassigned</option>
          {techs.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name || 'Technician'}
              {t.skills?.length
                ? ` · ${t.skills.slice(0, 3).join(', ')}`
                : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-700">
          Scheduled start
        </span>
        <input
          type="datetime-local"
          name="scheduled_start"
          defaultValue={toDatetimeLocalValue(initial?.scheduled_start)}
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-700">
          Priority
        </span>
        <select
          name="priority"
          defaultValue={initial?.priority || 'Medium'}
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
        >
          {JOB_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
    </>
  );

  return (
    <form
      action={formAction}
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        if (!customerId.trim()) {
          e.preventDefault();
          setClientError('Pick a customer before creating the job.');
          return;
        }
        const jobType = new FormData(e.currentTarget)
          .get('job_type')
          ?.toString()
          .trim();
        if (!jobType) {
          e.preventDefault();
          setClientError('Enter a job type (e.g. Service call, No cool).');
          return;
        }
        setClientError(null);
      }}
    >
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-ink-900">
            {quick ? 'Customer & problem' : 'Who & what'}
          </h2>
          <p className="text-xs text-ink-400">
            {quick
              ? 'Required: customer and job type. Schedule & assign are under More options.'
              : 'Customer, job type, and schedule — line items come after create.'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">
              Customer
            </span>
            <CustomerSearchSelect
              value={customerId}
              initialLabel={customerLabel}
              disabled={lockCustomer}
              onChange={(id, hit) => {
                setCustomerId(id);
                setCustomerLabel(hit?.name || '');
                setPropertyId('');
                if (id) setClientError(null);
              }}
            />
          </div>

          {!quick && (
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">
                Job # / name
              </span>
              <input
                name="job_number"
                defaultValue={jobNumberDefault}
                placeholder="#1 or River Market Bistro"
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
              />
              <p className="mt-1 text-xs text-ink-400">
                Defaults to the next number (#1, #2…). You can rename it anytime.
              </p>
            </label>
          )}

          {propertyOptions.length > 0 && (
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">
                Job site
              </span>
              <select
                name="property_id"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
              >
                {propertyOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">
              Job type
            </span>
            <input
              name="job_type"
              required
              list="hvac-job-types"
              defaultValue={initial?.job_type || ''}
              placeholder="Service call, No cool, Maintenance…"
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
            />
            <datalist id="hvac-job-types">
              {HVAC_JOB_TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </label>

          {quick && (
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">
                Diagnosis / problem notes
              </span>
              <DictationField
                name="diagnosis"
                value={diagnosis}
                onChange={setDiagnosis}
                rows={3}
                micLabel="Speak diagnosis"
                placeholder="Symptoms, call notes, what the customer said…"
              />
            </label>
          )}

          {!quick && scheduleAssignBlock}

          {!quick && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">
                Status
              </span>
              <select
                name="status"
                defaultValue={initial?.status || 'New'}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
              >
                {JOB_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>

      {quick && (
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          {showMore ? 'Hide more options' : 'More options'}
        </button>
      )}

      {(showMore || !quick) && (
        <section className="space-y-4 border-t border-ink-100 pt-5">
          <h2 className="text-sm font-semibold text-ink-900">
            {quick ? 'More options' : 'Optional details'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {quick && (
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-ink-700">
                  Job # / name
                </span>
                <input
                  name="job_number"
                  defaultValue={jobNumberDefault}
                  placeholder="#1 or River Market Bistro"
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
                />
                <p className="mt-1 text-xs text-ink-400">
                  Defaults to the next number (#1, #2…). You can rename it
                  anytime.
                </p>
              </label>
            )}

            {quick && scheduleAssignBlock}

            {quick && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink-700">
                  Status
                </span>
                <select
                  name="status"
                  defaultValue={initial?.status || 'New'}
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
                >
                  {JOB_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">
                Equipment
              </span>
              <select
                key={customerId}
                name="equipment_id"
                defaultValue={
                  initial?.customer_id === customerId
                    ? initial?.equipment_id || ''
                    : ''
                }
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
              >
                <option value="">— None —</option>
                {equipmentOptions.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name || eq.equipment_type || 'Unit'}
                    {eq.name && eq.equipment_type
                      ? ` (${eq.equipment_type})`
                      : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">
                Est. hours
              </span>
              <input
                name="est_hours"
                type="number"
                step="0.25"
                min="0"
                defaultValue={
                  initial?.est_hours === null ||
                  initial?.est_hours === undefined
                    ? ''
                    : String(initial.est_hours)
                }
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">
                Tax rate
              </span>
              <select
                name="tax_rate_id"
                defaultValue={initial?.tax_rate_id || 'kcmo-jackson'}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none ring-brand-500/30 focus:ring-4"
              >
                {taxRates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({(Number(t.rate) * 100).toFixed(3)}%)
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!quick && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">
                Diagnosis
              </span>
              <DictationField
                name="diagnosis"
                value={diagnosis}
                onChange={setDiagnosis}
                rows={3}
                micLabel="Speak diagnosis"
                placeholder="Symptoms, findings, recommended work…"
              />
            </label>
          )}

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                name="is_callback"
                value="on"
                defaultChecked={Boolean(initial?.is_callback)}
              />
              Callback
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                name="warranty_flag"
                value="on"
                defaultChecked={Boolean(initial?.warranty_flag)}
              />
              Warranty / no-charge parts
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">
              Internal notes
              <span className="ml-2 font-normal text-ink-400">
                office + tech only
              </span>
            </span>
            <DictationField
              name="internal_notes"
              value={internalNotes}
              onChange={setInternalNotes}
              rows={2}
              micLabel="Speak notes"
              placeholder="Gate code, dog in yard, call office before starting…"
              className="border-amber-200 bg-amber-50/40 outline-none ring-amber-500/20 focus:ring-4"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">
              Customer summary
            </span>
            <DictationField
              name="customer_summary"
              value={customerSummary}
              onChange={setCustomerSummary}
              rows={2}
              micLabel="Speak summary"
              placeholder="Work completed for the customer to see…"
              className="border-emerald-200 bg-emerald-50/30 outline-none ring-emerald-500/20 focus:ring-4"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">
              General notes
            </span>
            <DictationField
              name="notes"
              value={notes}
              onChange={setNotes}
              rows={2}
              micLabel="Speak notes"
            />
          </label>
        </section>
      )}

      {/* Defaults when More options is collapsed */}
      {quick && !showMore && (
        <>
          <input type="hidden" name="job_number" value={jobNumberDefault} />
          <input
            type="hidden"
            name="status"
            value={initial?.status || 'New'}
          />
          <input
            type="hidden"
            name="priority"
            value={initial?.priority || 'Medium'}
          />
          <input
            type="hidden"
            name="assigned_to"
            value={initial?.assigned_to || ''}
          />
          <input
            type="hidden"
            name="scheduled_start"
            value={toDatetimeLocalValue(initial?.scheduled_start)}
          />
          <input
            type="hidden"
            name="tax_rate_id"
            value={initial?.tax_rate_id || 'kcmo-jackson'}
          />
          {initial?.is_callback ? (
            <input type="hidden" name="is_callback" value="on" />
          ) : null}
          {initial?.warranty_flag ? (
            <input type="hidden" name="warranty_flag" value="on" />
          ) : null}
          {initial?.equipment_id ? (
            <input
              type="hidden"
              name="equipment_id"
              value={initial.equipment_id}
            />
          ) : null}
          {initial?.est_hours != null && initial.est_hours !== '' ? (
            <input
              type="hidden"
              name="est_hours"
              value={String(initial.est_hours)}
            />
          ) : null}
          {initial?.internal_notes ? (
            <input
              type="hidden"
              name="internal_notes"
              value={initial.internal_notes}
            />
          ) : null}
          {initial?.customer_summary ? (
            <input
              type="hidden"
              name="customer_summary"
              value={initial.customer_summary}
            />
          ) : null}
          {initial?.notes ? (
            <input type="hidden" name="notes" value={initial.notes} />
          ) : null}
        </>
      )}

      {(clientError || state.error) && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {clientError || state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 sm:w-auto sm:py-2.5"
      >
        {pending ? 'Saving…' : submitLabel}
      </button>
      {!customerId && !lockCustomer && (
        <p className="text-xs text-ink-400">
          Search and select a customer above, then tap {submitLabel}.
        </p>
      )}
    </form>
  );
}
