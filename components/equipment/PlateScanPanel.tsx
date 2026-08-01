'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveScannedEquipment } from '@/app/dashboard/customers/actions';
import { EQUIPMENT_TYPES } from '@/lib/validations/equipment';

type Extracted = {
  manufacturer?: string | null;
  model_number?: string | null;
  serial_number?: string | null;
  equipment_type?: string | null;
  capacity?: string | null;
  voltage?: string | null;
  phase?: string | null;
  amperage?: string | null;
  refrigerant?: string | null;
  electrical?: string | null;
  filter_size?: string | null;
  filter_qty?: number | string | null;
  notes?: string | null;
};

type FilterLookup = {
  filter_size?: string | null;
  filter_qty?: number | null;
  source?: string | null;
  confidence?: string | null;
  searched?: boolean;
};

export function PlateScanPanel({
  customerId,
  jobId,
  onClose,
}: {
  customerId: string;
  /** When set, new equipment is linked to this job. */
  jobId?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [unitName, setUnitName] = useState('');
  const [equipmentType, setEquipmentType] = useState('RTU');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [capacity, setCapacity] = useState('');
  const [electrical, setElectrical] = useState('');
  const [refrigerant, setRefrigerant] = useState('');
  const [filterSize, setFilterSize] = useState('');
  const [filterQty, setFilterQty] = useState('');
  const [notes, setNotes] = useState('');

  const typeOptions = useMemo(() => {
    if (
      extracted?.equipment_type &&
      !EQUIPMENT_TYPES.includes(
        extracted.equipment_type as (typeof EQUIPMENT_TYPES)[number]
      )
    ) {
      return [extracted.equipment_type, ...EQUIPMENT_TYPES];
    }
    return [...EQUIPMENT_TYPES];
  }, [extracted?.equipment_type]);

  function onFileChange(next: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setExtracted(null);
    setUnitName('');
    setLookupNote(null);
    setStatus(null);
    setError(null);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
  }

  function suggestUnitName(type: string) {
    const base = type.trim() || 'Unit';
    // Soft default only when empty — user can change to RTU 1 / Furnace 2, etc.
    return `${base} 1`;
  }

  function applyExtracted(data: Extracted) {
    setExtracted(data);
    const type = data.equipment_type?.trim() || 'Other';
    setEquipmentType(type);
    setUnitName((prev) => prev.trim() || suggestUnitName(type));
    setManufacturer(data.manufacturer || '');
    setModel(data.model_number || '');
    setSerial(data.serial_number || '');
    setCapacity(data.capacity || '');
    setElectrical(
      data.electrical ||
        [data.voltage, data.phase, data.amperage].filter(Boolean).join(' ')
    );
    setRefrigerant(data.refrigerant || '');
    if (data.filter_size) setFilterSize(data.filter_size);
    if (data.filter_qty !== null && data.filter_qty !== undefined) {
      setFilterQty(String(data.filter_qty));
    }
    setNotes(data.notes || '');
  }

  function applyFilterLookup(fl: FilterLookup) {
    if (fl.filter_size) setFilterSize(fl.filter_size);
    if (fl.filter_qty != null) setFilterQty(String(fl.filter_qty));

    if (fl.filter_size || fl.filter_qty != null) {
      setLookupNote(
        `Filter lookup: ${fl.filter_size || '—'} × ${fl.filter_qty ?? '—'}${
          fl.source ? ` · ${fl.source}` : ''
        }${fl.confidence ? ` (${fl.confidence})` : ''}`
      );
      if (fl.source) {
        setNotes((prev) => {
          const line = `Filter lookup: ${fl.source}${
            fl.confidence ? ` (${fl.confidence})` : ''
          }`;
          return prev.includes(line) ? prev : prev ? `${prev}\n${line}` : line;
        });
      }
    } else {
      setLookupNote(
        'Could not confirm filter size/qty. Enter them manually if you know them.'
      );
    }
  }

  async function checkFilters() {
    if (!manufacturer.trim() && !model.trim()) {
      setLookupNote('Need manufacturer or model before checking filters.');
      return;
    }
    setLookingUp(true);
    setError(null);
    setStatus('Looking up OEM filter size for this model…');
    try {
      const res = await fetch('/api/ai/lookup-filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manufacturer,
          model_number: model,
          serial_number: serial,
          equipment_type: equipmentType,
          mode: 'web',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Filter lookup failed');
      applyFilterLookup(json.filterLookup || {});
    } catch (err) {
      setLookupNote(
        err instanceof Error
          ? err.message
          : 'Filter lookup failed — enter size/qty manually.'
      );
    } finally {
      setLookingUp(false);
      setStatus(null);
    }
  }

  async function analyze() {
    if (!file) {
      setError('Choose a data plate photo first.');
      return;
    }
    setAnalyzing(true);
    setError(null);
    setLookupNote(null);
    setStatus('Reading data plate…');
    try {
      const body = new FormData();
      body.append('image', file);
      body.append('customerId', customerId);

      const res = await fetch('/api/ai/analyze-plate', {
        method: 'POST',
        body,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Analysis failed');
      }

      const plate = (json.extracted || {}) as Extracted;
      applyExtracted(plate);
      if (
        plate.filter_size?.trim() &&
        plate.filter_qty !== null &&
        plate.filter_qty !== undefined
      ) {
        setLookupNote('Filter size/qty came from the data plate image.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
      setStatus(null);
    }
  }

  async function save() {
    if (!file) {
      setError('Original photo is required to save.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('image', file);
      body.append('name', unitName);
      body.append('equipment_type', equipmentType);
      body.append('manufacturer', manufacturer);
      body.append('model', model);
      body.append('serial_number', serial);
      body.append('capacity', capacity);
      body.append('electrical', electrical);
      body.append('refrigerant', refrigerant);
      body.append('filter_size', filterSize);
      body.append('filter_qty', filterQty);
      body.append('notes', notes);
      if (jobId) body.append('job_id', jobId);

      const result = await saveScannedEquipment(customerId, body);
      if (result.error) throw new Error(result.error);

      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const busy = analyzing || lookingUp;

  return (
    <div className="mb-4 space-y-4 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-ink-950">
            Scan data plate
          </h3>
          <p className="mt-0.5 text-sm text-ink-600">
            Reads the nameplate. Use Check filters only if you want size/qty
            looked up — or type them in yourself.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
        >
          Close
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-600">
              Plate photo
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => onFileChange(e.target.files?.[0] || null)}
              className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
            />
          </label>

          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Data plate preview"
              className="h-40 w-full rounded-lg border border-ink-200 object-cover"
            />
          )}

          <button
            type="button"
            onClick={analyze}
            disabled={!file || busy}
            className="w-full rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {analyzing ? 'Reading data plate…' : 'Analyze with Grok'}
          </button>
        </div>

        <div className="space-y-3">
          {!extracted ? (
            <p className="rounded-lg border border-dashed border-ink-200 bg-white px-4 py-8 text-center text-sm text-ink-500">
              Results appear here after analysis. You can edit anything before
              saving.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Name / label"
                  value={unitName}
                  onChange={setUnitName}
                  placeholder="RTU 1"
                />
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-600">
                    Type
                  </span>
                  <select
                    value={equipmentType}
                    onChange={(e) => {
                      const next = e.target.value;
                      setEquipmentType(next);
                      setUnitName((prev) => {
                        // Update default label if user hasn't customized yet
                        if (!prev.trim() || /^[A-Za-z0-9 /+-]+ 1$/.test(prev)) {
                          return suggestUnitName(next);
                        }
                        return prev;
                      });
                    }}
                    className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                  >
                    {typeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <Field label="Manufacturer" value={manufacturer} onChange={setManufacturer} />
                <Field label="Model" value={model} onChange={setModel} />
                <Field label="Serial" value={serial} onChange={setSerial} />
                <Field label="Capacity" value={capacity} onChange={setCapacity} />
                <Field
                  label="Electrical"
                  value={electrical}
                  onChange={setElectrical}
                />
                <Field
                  label="Refrigerant"
                  value={refrigerant}
                  onChange={setRefrigerant}
                />
                <Field
                  label="Filter size"
                  value={filterSize}
                  onChange={setFilterSize}
                  placeholder="20x20x2"
                />
                <Field
                  label="Filter qty"
                  value={filterQty}
                  onChange={setFilterQty}
                  placeholder="2"
                  inputMode="numeric"
                />
              </div>
              <button
                type="button"
                disabled={lookingUp || analyzing}
                onClick={checkFilters}
                className="w-full rounded-lg border border-brand-300 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-60 sm:w-auto"
              >
                {lookingUp ? 'Checking filters…' : 'Check filters'}
              </button>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-600">
                  Notes
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={save}
                disabled={saving || lookingUp}
                className="rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save to property'}
              </button>
            </>
          )}
        </div>
      </div>

      {status && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
          {status}
        </p>
      )}
      {lookupNote && (
        <p className="rounded-lg bg-white px-3 py-2 text-sm text-ink-600 ring-1 ring-ink-200">
          {lookupNote}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-600">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
      />
    </label>
  );
}
