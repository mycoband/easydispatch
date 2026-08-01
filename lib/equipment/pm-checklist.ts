/** Default HVAC PM checklist items (shops can customize per unit). */
export const DEFAULT_PM_ITEMS: { id: string; label: string }[] = [
  { id: 'filters', label: 'Filters inspected / replaced' },
  { id: 'coils', label: 'Coils cleaned / inspected' },
  { id: 'drain', label: 'Condensate drain clear' },
  { id: 'electrical', label: 'Electrical connections tight' },
  { id: 'capacitor', label: 'Capacitors / contactor checked' },
  { id: 'refrigerant', label: 'Refrigerant pressures / temps noted' },
  { id: 'blower', label: 'Blower / belt / motor OK' },
  { id: 'safety', label: 'Safety controls tested' },
  { id: 'thermostat', label: 'Thermostat operation verified' },
  { id: 'outdoor', label: 'Outdoor unit clear / level' },
];

/** @deprecated use DEFAULT_PM_ITEMS */
export const EQUIPMENT_PM_ITEMS = DEFAULT_PM_ITEMS;

export type PmPhoto = {
  url: string;
  attachmentId?: string | null;
  at?: string | null;
};

export type PmCheckRow = {
  checked: boolean;
  at?: string | null;
  photos?: PmPhoto[];
};

export type PmChecklistItem = {
  id: string;
  label: string;
};

/** Stored on equipment.pm_checklist (v2) — legacy flat maps are migrated on read. */
export type PmChecklistDoc = {
  version: 2;
  items: PmChecklistItem[];
  checks: Record<string, PmCheckRow>;
};

/** Legacy shape for older callers */
export type PmChecklistState = Record<string, PmCheckRow>;

export function newCustomPmItemId() {
  return `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function isLegacyFlat(raw: Record<string, unknown>): boolean {
  if (raw.version === 2 && Array.isArray(raw.items)) return false;
  // Legacy: keys are item ids with { checked }
  return Object.values(raw).some(
    (v) => v && typeof v === 'object' && !Array.isArray(v) && 'checked' in (v as object)
  );
}

export function normalizePmChecklist(raw: unknown): PmChecklistDoc {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      version: 2,
      items: DEFAULT_PM_ITEMS.map((i) => ({ ...i })),
      checks: {},
    };
  }

  const src = raw as Record<string, unknown>;

  if (src.version === 2 && Array.isArray(src.items)) {
    const items: PmChecklistItem[] = [];
    for (const row of src.items) {
      if (!row || typeof row !== 'object') continue;
      const r = row as { id?: unknown; label?: unknown };
      const id = typeof r.id === 'string' ? r.id.trim() : '';
      const label = typeof r.label === 'string' ? r.label.trim() : '';
      if (!id || !label) continue;
      items.push({ id, label });
    }
    const checksSrc =
      src.checks && typeof src.checks === 'object' && !Array.isArray(src.checks)
        ? (src.checks as Record<string, unknown>)
        : {};
    const checks: Record<string, PmCheckRow> = {};
    for (const item of items) {
      checks[item.id] = parseCheckRow(checksSrc[item.id]);
    }
    // Keep check data for removed ids? drop — only current items
    return {
      version: 2,
      items: items.length ? items : DEFAULT_PM_ITEMS.map((i) => ({ ...i })),
      checks,
    };
  }

  if (isLegacyFlat(src)) {
    const items = DEFAULT_PM_ITEMS.map((i) => ({ ...i }));
    const checks: Record<string, PmCheckRow> = {};
    for (const item of items) {
      checks[item.id] = parseCheckRow(src[item.id]);
    }
    // Preserve any custom legacy keys not in defaults
    for (const [key, val] of Object.entries(src)) {
      if (key === 'version' || key === 'items' || key === 'checks') continue;
      if (items.some((i) => i.id === key)) continue;
      if (val && typeof val === 'object' && !Array.isArray(val) && 'checked' in (val as object)) {
        items.push({ id: key, label: key.replace(/_/g, ' ') });
        checks[key] = parseCheckRow(val);
      }
    }
    return { version: 2, items, checks };
  }

  return {
    version: 2,
    items: DEFAULT_PM_ITEMS.map((i) => ({ ...i })),
    checks: {},
  };
}

function parseCheckRow(v: unknown): PmCheckRow {
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    return { checked: false, at: null, photos: [] };
  }
  const row = v as {
    checked?: unknown;
    at?: unknown;
    photos?: unknown;
  };
  const photos: PmPhoto[] = [];
  if (Array.isArray(row.photos)) {
    for (const p of row.photos) {
      if (!p || typeof p !== 'object') continue;
      const ph = p as { url?: unknown; attachmentId?: unknown; at?: unknown };
      if (typeof ph.url === 'string' && ph.url.trim()) {
        photos.push({
          url: ph.url.trim(),
          attachmentId:
            typeof ph.attachmentId === 'string' ? ph.attachmentId : null,
          at: typeof ph.at === 'string' ? ph.at : null,
        });
      }
    }
  }
  return {
    checked: Boolean(row.checked),
    at: typeof row.at === 'string' ? row.at : null,
    photos,
  };
}

export function countPmDone(doc: PmChecklistDoc) {
  return doc.items.filter((i) => Boolean(doc.checks[i.id]?.checked)).length;
}

export function serializePmChecklist(doc: PmChecklistDoc): PmChecklistDoc {
  const checks: Record<string, PmCheckRow> = {};
  for (const item of doc.items) {
    const row = doc.checks[item.id] || {
      checked: false,
      at: null,
      photos: [],
    };
    checks[item.id] = {
      checked: Boolean(row.checked),
      at: row.at || null,
      photos: row.photos || [],
    };
  }
  return {
    version: 2,
    items: doc.items.map((i) => ({
      id: i.id,
      label: i.label.trim(),
    })),
    checks,
  };
}
