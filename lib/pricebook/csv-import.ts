import { mapHeadersToFields, parseBool, parseCsv } from '@/lib/csv/parse';

export type PricebookImportRow = {
  name: string;
  description: string;
  category: string;
  unit_price: number;
  taxable: boolean;
  active: boolean;
  sort_order: number;
};

export type ParsedPricebookRow = {
  line: number;
  raw: Record<string, string>;
  data: PricebookImportRow | null;
  error?: string;
};

const HEADER_ALIASES: Record<keyof PricebookImportRow, string[]> = {
  name: [
    'name',
    'item',
    'item name',
    'service',
    'service name',
    'description',
    'product',
    'product name',
    'rate',
    'rate name',
  ],
  description: [
    'description',
    'details',
    'long description',
    'notes',
    'memo',
  ],
  category: ['category', 'type', 'group', 'department', 'class'],
  unit_price: [
    'unit_price',
    'unit price',
    'price',
    'amount',
    'rate',
    'flat rate',
    'sell',
    'sell price',
    'cost',
  ],
  taxable: ['taxable', 'tax', 'is taxable', 'tax flag'],
  active: ['active', 'enabled', 'is active', 'status'],
  sort_order: ['sort_order', 'sort order', 'sort', 'order', 'position'],
};

export const PRICEBOOK_IMPORT_TEMPLATE_HEADERS = [
  'name',
  'description',
  'category',
  'unit_price',
  'taxable',
  'active',
  'sort_order',
] as const;

export const PRICEBOOK_IMPORT_TEMPLATE_CSV = [
  PRICEBOOK_IMPORT_TEMPLATE_HEADERS.join(','),
  '"Diagnostic fee","Trip + first 30 minutes","Service",89,true,true,10',
  '"Labor hour","Additional labor per hour","Labor",125,true,true,20',
  '"Capacitor 45/5","Dual run capacitor","Parts",48.5,true,true,30',
].join('\n');

export function parsePricebookCsv(text: string): {
  rows: ParsedPricebookRow[];
  headers: string[];
  error?: string;
} {
  const table = parseCsv(text);
  if (table.length < 2) {
    return {
      rows: [],
      headers: [],
      error: 'CSV needs a header row and at least one data row',
    };
  }

  const headers = table[0];
  const mapping = mapHeadersToFields(headers, HEADER_ALIASES);

  // Prefer a dedicated name column; if description is the only label column, use it.
  if (mapping.name === undefined && mapping.description === undefined) {
    return {
      rows: [],
      headers,
      error:
        'Could not find a Name / Item column. Download the template or rename a header to "name".',
    };
  }

  // If both name and description map to the same column (alias overlap), keep name.
  if (
    mapping.name !== undefined &&
    mapping.description === mapping.name
  ) {
    delete mapping.description;
  }

  const rows: ParsedPricebookRow[] = [];

  for (let i = 1; i < table.length; i++) {
    const cells = table[i];
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h] = (cells[idx] ?? '').trim();
    });

    const pick = (key: keyof PricebookImportRow) => {
      const idx = mapping[key];
      return idx === undefined ? '' : (cells[idx] ?? '').trim();
    };

    const name = pick('name') || pick('description');
    if (!name) {
      rows.push({ line: i + 1, raw, data: null, error: 'Name is required' });
      continue;
    }

    const priceRaw = pick('unit_price').replace(/[$,]/g, '');
    const unit_price = priceRaw ? Number(priceRaw) : 0;
    if (!Number.isFinite(unit_price) || unit_price < 0) {
      rows.push({
        line: i + 1,
        raw,
        data: null,
        error: 'Invalid unit price',
      });
      continue;
    }

    const sortRaw = pick('sort_order');
    const sort_order = sortRaw ? Number(sortRaw) : i * 10;
    const activeRaw = pick('active');

    rows.push({
      line: i + 1,
      raw,
      data: {
        name: name.slice(0, 200),
        description: (pick('description') || name).slice(0, 500),
        category: (pick('category') || 'General').slice(0, 100),
        unit_price,
        taxable: parseBool(pick('taxable'), true),
        active: activeRaw
          ? parseBool(activeRaw, true) &&
            !['inactive', 'disabled', 'archived'].includes(
              activeRaw.toLowerCase()
            )
          : true,
        sort_order: Number.isFinite(sort_order) ? sort_order : i * 10,
      },
    });
  }

  return { rows, headers };
}
