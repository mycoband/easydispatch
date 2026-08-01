export type WarrantyInfo = {
  warranty_parts_expires?: string | null;
  warranty_labor_expires?: string | null;
  warranty_notes?: string | null;
  install_date?: string | null;
};

export type WarrantyStatus = {
  partsActive: boolean;
  laborActive: boolean;
  partsExpires: string | null;
  laborExpires: string | null;
  label: string | null;
  tone: 'green' | 'amber' | 'slate';
};

function parseDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value + (value.length === 10 ? 'T12:00:00' : ''));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getWarrantyStatus(
  info: WarrantyInfo,
  now = new Date()
): WarrantyStatus {
  const parts = parseDate(info.warranty_parts_expires);
  const labor = parseDate(info.warranty_labor_expires);
  const partsActive = Boolean(parts && parts >= now);
  const laborActive = Boolean(labor && labor >= now);

  let label: string | null = null;
  let tone: WarrantyStatus['tone'] = 'slate';

  if (partsActive || laborActive) {
    const bits = [
      partsActive ? 'parts' : null,
      laborActive ? 'labor' : null,
    ].filter(Boolean);
    label = `Under warranty (${bits.join(' + ')})`;
    tone = 'green';
  } else if (parts || labor) {
    label = 'Warranty expired';
    tone = 'amber';
  } else if (info.install_date) {
    label = 'No warranty dates on file';
    tone = 'slate';
  }

  return {
    partsActive,
    laborActive,
    partsExpires: info.warranty_parts_expires || null,
    laborExpires: info.warranty_labor_expires || null,
    label,
    tone,
  };
}

export function formatShortDate(value?: string | null) {
  if (!value) return '—';
  const d = parseDate(value);
  if (!d) return value;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
