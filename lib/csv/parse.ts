/** Shared RFC4180-ish CSV helpers for customer / pricebook imports. */

export function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export function mapHeadersToFields<T extends string>(
  headers: string[],
  aliases: Record<T, string[]>
): Partial<Record<T, number>> {
  const normalized = headers.map(normalizeHeader);
  const mapping: Partial<Record<T, number>> = {};
  for (const [field, list] of Object.entries(aliases) as [T, string[]][]) {
    const idx = normalized.findIndex((h) => list.includes(h));
    if (idx >= 0) mapping[field] = idx;
  }
  return mapping;
}

export function parseBool(value: string, fallback = true) {
  const v = value.trim().toLowerCase();
  if (!v) return fallback;
  if (['1', 'true', 'yes', 'y', 'on', 'taxable'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'exempt'].includes(v)) return false;
  return fallback;
}
