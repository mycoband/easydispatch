'use client';

import { useMemo, useState } from 'react';
import type { ActionState } from '@/app/dashboard/jobs/actions';
import { JobForm } from '@/components/jobs/JobForm';
import {
  TicketAiFill,
  type TicketAiFillResult,
} from '@/components/jobs/TicketAiFill';

type Customer = { id: string; name: string };
type Equipment = {
  id: string;
  name: string | null;
  equipment_type: string | null;
};
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

function localToIso(local: string | null | undefined): string | null {
  if (!local?.trim()) return null;
  const d = new Date(local.trim());
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function JobFormWithAi({
  action,
  customers,
  equipmentByCustomer,
  propertiesByCustomer = {},
  techs,
  taxRates,
  initial,
  submitLabel,
  enableAi = true,
  suggestedJobNumber,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  customers: Customer[];
  equipmentByCustomer: Record<string, Equipment[]>;
  propertiesByCustomer?: Record<string, Property[]>;
  techs: Tech[];
  taxRates: TaxRate[];
  initial?: JobValues;
  submitLabel: string;
  enableAi?: boolean;
  suggestedJobNumber?: string;
}) {
  const [values, setValues] = useState<JobValues>(initial || {});
  const [formKey, setFormKey] = useState(0);
  const [expandOptional, setExpandOptional] = useState(false);
  const [suggestedLines, setSuggestedLines] = useState<
    TicketAiFillResult['suggested_line_items']
  >([]);

  const hasOptional = useMemo(() => {
    return Boolean(
      values.diagnosis ||
        values.internal_notes ||
        values.customer_summary ||
        values.notes ||
        values.est_hours ||
        values.is_callback ||
        values.warranty_flag ||
        expandOptional
    );
  }, [values, expandOptional]);

  function applyFill(fill: TicketAiFillResult) {
    const scheduledIso = localToIso(fill.scheduled_start_local || null);
    setValues((prev) => ({
      ...prev,
      customer_id: fill.matched_customer_id || prev.customer_id,
      customer_name: fill.matched_customer_name || prev.customer_name,
      job_type: fill.job_type || prev.job_type,
      priority: fill.priority || prev.priority,
      status: scheduledIso ? 'Scheduled' : fill.status || prev.status || 'New',
      diagnosis: fill.diagnosis || prev.diagnosis,
      customer_summary: fill.customer_summary ?? prev.customer_summary,
      internal_notes: fill.internal_notes ?? prev.internal_notes,
      notes: fill.notes ?? prev.notes,
      est_hours:
        fill.est_hours === null || fill.est_hours === undefined
          ? prev.est_hours
          : fill.est_hours,
      is_callback: fill.is_callback,
      warranty_flag: fill.warranty_flag,
      scheduled_start: scheduledIso || prev.scheduled_start,
    }));
    setSuggestedLines(fill.suggested_line_items || []);
    setExpandOptional(true);
    setFormKey((k) => k + 1);
  }

  return (
    <div className="space-y-5">
      {enableAi && <TicketAiFill onFilled={applyFill} />}

      {suggestedLines.length > 0 && (
        <div className="rounded-xl border border-ink-200 bg-ink-50/70 px-4 py-3 text-sm">
          <p className="font-semibold text-ink-900">
            Suggested line items (add after create)
          </p>
          <ul className="mt-2 space-y-1 text-ink-600">
            {suggestedLines.map((line, i) => (
              <li key={`${line.description}-${i}`}>
                {line.qty || 1}× {line.description}
                {line.unit_price != null
                  ? ` · $${Number(line.unit_price).toFixed(2)}`
                  : ''}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-400">
            Pricebook / line items are edited on the job after it’s created.
          </p>
        </div>
      )}

      <JobForm
        key={formKey}
        action={action}
        customers={customers}
        equipmentByCustomer={equipmentByCustomer}
        propertiesByCustomer={propertiesByCustomer}
        techs={techs}
        taxRates={taxRates}
        initial={values}
        submitLabel={submitLabel}
        quick={!hasOptional}
        suggestedJobNumber={suggestedJobNumber}
      />
    </div>
  );
}
