import { customerSchema } from '@/lib/validations/customer';

export type ImportSite = {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  access_notes: string;
  is_primary: boolean;
};

export type ImportRow = {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  notes: string;
  access_notes: string;
  site_name: string;
  /** All service sites (primary first). Used by Housecall Pro multi-address exports. */
  sites: ImportSite[];
};

export type ParsedImportRow = {
  line: number;
  raw: Record<string, string>;
  data: ImportRow | null;
  error?: string;
};

/** Client/server batch size for large CSV imports (must stay in sync with import action). */
export const IMPORT_BATCH_SIZE = 150;

export const CUSTOMER_IMPORT_TEMPLATE_HEADERS = [
  'name',
  'address',
  'city',
  'state',
  'zip',
  'phone',
  'email',
  'notes',
  'access_notes',
  'site_name',
] as const;

export const CUSTOMER_IMPORT_TEMPLATE_CSV = [
  CUSTOMER_IMPORT_TEMPLATE_HEADERS.join(','),
  '"Acme Fitness - Main St","123 Main St","Springfield","IL","62701","(217) 555-0100","manager@acme.example","Preferred AM appointments","Gate 4321 · dog in yard","Primary"',
  '"Smith Residence","456 Oak Ave","Austin","TX","78701","(512) 555-0199","jane@example.com","","Lockbox 9988","Primary"',
].join('\n');

const STATE_NAMES: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'district of columbia': 'DC',
};

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeState(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return STATE_NAMES[raw.toLowerCase()] || raw.slice(0, 2).toUpperCase();
}

/** Decode Excel / Windows exports (UTF-8, UTF-16, etc.). */
export function decodeCsvBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes);
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return new TextDecoder('utf-8').decode(bytes);
  }
  const sample = bytes.slice(0, Math.min(bytes.length, 200));
  let nulls = 0;
  for (const b of sample) if (b === 0) nulls++;
  if (nulls > sample.length / 4) {
    return new TextDecoder('utf-16le').decode(bytes);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function detectDelimiter(headerLine: string): string {
  let inQuotes = false;
  let commas = 0;
  let semis = 0;
  let tabs = 0;
  for (let i = 0; i < headerLine.length; i++) {
    const ch = headerLine[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === ',') commas++;
    else if (ch === ';') semis++;
    else if (ch === '\t') tabs++;
  }
  if (tabs > commas && tabs > semis) return '\t';
  if (semis > commas) return ';';
  return ',';
}

/** RFC4180-ish CSV parse with comma / semicolon / tab delimiters. */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const input = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const firstLine = input.split('\n').find((l) => l.trim()) || '';
  const delim = delimiter || detectDelimiter(firstLine);

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
    } else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export function digitsOnly(value?: string | null) {
  return (value || '').replace(/\D/g, '');
}

/** Normalize for duplicate name comparison. */
export function normalizeCustomerName(name?: string | null) {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Email alone is a weak duplicate key in HCP exports — shops often put the same
 * AP/invoice inbox on many commercial accounts. Require similar names for email matches.
 */
export function namesLikelySame(
  a?: string | null,
  b?: string | null
): boolean {
  const na = normalizeCustomerName(a);
  const nb = normalizeCustomerName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 8 && nb.length >= 8 && (na.includes(nb) || nb.includes(na))) {
    return true;
  }
  return false;
}

/**
 * Skip junk HCP / CRM rows where "customer" is just a phone number or digits.
 */
export function isJunkCustomerName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;

  // Pure digits / phone punctuation: 8165551212, (816) 555-1212
  if (/^[\d\s\-().#+]+$/.test(trimmed)) return true;

  const letters = (trimmed.match(/[A-Za-z]/g) || []).length;
  const digits = digitsOnly(trimmed);
  // Mostly a phone with almost no letters
  if (digits.length >= 7 && letters < 2) return true;
  // Single letter + long digit string
  if (digits.length >= 10 && letters <= 2) return true;

  return false;
}

/** Pull city/state/zip out of HCP "Street Line 2" when City/State/Zip columns are empty. */
export function parseMashedLocality(value: string): {
  city: string;
  state: string;
  zip: string;
  leftover: string;
} {
  const trimmed = value.trim();
  if (!trimmed) return { city: '', state: '', zip: '', leftover: '' };

  // "Kansas City MO 64154" / "Olathe Kansas 66061"
  let m = trimmed.match(
    /^(.*?)\s+([A-Za-z]{2}|[A-Za-z]{4,})\s+(\d{5}(?:-\d{4})?)$/
  );
  if (m) {
    const state = normalizeState(m[2]);
    if (state.length === 2) {
      return { city: m[1].trim(), state, zip: m[3], leftover: '' };
    }
  }

  // "overland park ks" (no zip)
  m = trimmed.match(/^(.*?)\s+([A-Za-z]{2})$/);
  if (m && /^[A-Za-z]{2}$/.test(m[2])) {
    return {
      city: m[1].trim(),
      state: m[2].toUpperCase(),
      zip: '',
      leftover: '',
    };
  }

  // "Olathe Kansas" (full state, no zip)
  m = trimmed.match(/^(.*?)\s+([A-Za-z]{4,})$/);
  if (m) {
    const state = normalizeState(m[2]);
    if (state.length === 2 && STATE_NAMES[m[2].toLowerCase()]) {
      return { city: m[1].trim(), state, zip: '', leftover: '' };
    }
  }

  return { city: '', state: '', zip: '', leftover: trimmed };
}

function cleanEmail(email: string) {
  const v = email.trim();
  if (!v) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return '';
  return v;
}

function pickPhone(...values: string[]) {
  for (const v of values) {
    const d = digitsOnly(v);
    if (d.length >= 7) return v.trim();
  }
  return (values.find((v) => v.trim()) || '').trim();
}

function siteFromParts(parts: {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  is_primary: boolean;
}): ImportSite | null {
  let address = parts.line1.trim();
  let city = parts.city.trim();
  let state = normalizeState(parts.state);
  let zip = parts.zip.trim();
  const line2 = parts.line2.trim();

  if ((!city || !state) && line2) {
    const mashed = parseMashedLocality(line2);
    if (mashed.city || mashed.state || mashed.zip) {
      if (!city) city = mashed.city;
      if (!state) state = mashed.state;
      if (!zip) zip = mashed.zip;
    } else if (mashed.leftover) {
      // Apt / suite / extra street info
      address = address
        ? `${address}, ${mashed.leftover}`
        : mashed.leftover;
    }
  } else if (line2 && !parseMashedLocality(line2).city) {
    // Structured city present — line2 is unit/suite
    address = address ? `${address}, ${line2}` : line2;
  }

  if (!address && !city && !zip) return null;

  return {
    name: parts.name.trim() || (parts.is_primary ? 'Primary' : 'Site'),
    address,
    city,
    state,
    zip,
    access_notes: parts.notes.trim(),
    is_primary: parts.is_primary,
  };
}

function toImportRow(candidate: {
  name: string;
  phone: string;
  email: string;
  notes: string;
  sites: ImportSite[];
}): ImportRow | null {
  const primary =
    candidate.sites.find((s) => s.is_primary) || candidate.sites[0] || null;
  const sites = candidate.sites.length
    ? candidate.sites
    : [
        {
          name: 'Primary',
          address: '',
          city: '',
          state: '',
          zip: '',
          access_notes: '',
          is_primary: true,
        },
      ];

  const row: ImportRow = {
    name: candidate.name.trim(),
    address: primary?.address || '',
    city: primary?.city || '',
    state: primary?.state || '',
    zip: primary?.zip || '',
    phone: candidate.phone,
    email: candidate.email,
    notes: candidate.notes,
    access_notes: primary?.access_notes || '',
    site_name: primary?.name || 'Primary',
    sites,
  };

  // Truncate oversized fields on import instead of rejecting the whole customer
  // (multi-site commercial accounts often have long notes / mashed addresses).
  const soft = {
    name: row.name.slice(0, 200),
    address: row.address.slice(0, 300),
    city: row.city.slice(0, 100),
    state: row.state.slice(0, 2),
    zip: row.zip.slice(0, 12),
    phone: row.phone.slice(0, 40),
    email: row.email.slice(0, 200),
    notes: row.notes.slice(0, 5000),
    access_notes: row.access_notes.slice(0, 5000),
  };

  const parsed = customerSchema.safeParse(soft);
  if (!parsed.success) return null;
  return {
    ...row,
    name: parsed.data.name,
    address: parsed.data.address || '',
    city: parsed.data.city || '',
    state: parsed.data.state || soft.state,
    zip: parsed.data.zip || '',
    phone: parsed.data.phone || '',
    email: parsed.data.email || '',
    notes: parsed.data.notes || '',
    access_notes: parsed.data.access_notes || '',
    sites: row.sites.map((s, i) => ({
      ...s,
      name: (s.name || (i === 0 ? 'Primary' : `Site ${i + 1}`)).slice(0, 200),
      address: s.address.slice(0, 300),
      city: s.city.slice(0, 100),
      state: s.state.slice(0, 2),
      zip: s.zip.slice(0, 12),
      access_notes: s.access_notes.slice(0, 5000),
    })),
  };
}

function isHousecallProExport(headers: string[]) {
  const n = headers.map(normalizeHeader);
  const hasDisplay = n.includes('display name');
  const hasFirst = n.includes('first name');
  const hasAddr = n.some(
    (h) =>
      h === 'address 1 street line 1' ||
      h.startsWith('address 1 street') ||
      h === 'mobile number'
  );
  return hasDisplay && hasFirst && hasAddr;
}

function headerIndexMap(headers: string[]) {
  const map = new Map<string, number>();
  headers.forEach((h, i) => map.set(normalizeHeader(h), i));
  return map;
}

function cellAt(cells: string[], map: Map<string, number>, header: string) {
  const idx = map.get(normalizeHeader(header));
  if (idx === undefined) return '';
  return (cells[idx] ?? '').trim();
}

function parseHousecallProRows(
  table: string[][],
  headers: string[]
): ParsedImportRow[] {
  const map = headerIndexMap(headers);
  const rows: ParsedImportRow[] = [];

  for (let i = 1; i < table.length; i++) {
    const cells = table[i];
    const raw: Record<string, string> = {};
    // Keep a compact raw for preview (not all 140 address columns)
    for (const key of [
      'First Name',
      'Last Name',
      'Display Name',
      'Company',
      'Mobile Number',
      'Home Number',
      'Work Number',
      'Email',
      'Notes',
      'Do Not Service',
      'Address_1 Street Line 1',
      'Address_1 City',
    ]) {
      raw[key] = cellAt(cells, map, key);
    }

    const display = cellAt(cells, map, 'Display Name');
    const first = cellAt(cells, map, 'First Name');
    const last = cellAt(cells, map, 'Last Name');
    const company = cellAt(cells, map, 'Company');
    const name =
      display || [first, last].filter(Boolean).join(' ').trim() || company;

    if (!name) {
      rows.push({
        line: i + 1,
        raw,
        data: null,
        error: 'Skipped: missing name',
      });
      continue;
    }

    if (isJunkCustomerName(name)) {
      rows.push({
        line: i + 1,
        raw,
        data: null,
        error: 'Skipped: name looks like a phone number / ID',
      });
      continue;
    }

    if (cellAt(cells, map, 'Do Not Service').toUpperCase() === 'TRUE') {
      rows.push({
        line: i + 1,
        raw,
        data: null,
        error: 'Skipped: Do Not Service',
      });
      continue;
    }

    const phone = pickPhone(
      cellAt(cells, map, 'Mobile Number'),
      cellAt(cells, map, 'Home Number'),
      cellAt(cells, map, 'Work Number')
    );
    const primaryEmail = cleanEmail(cellAt(cells, map, 'Email'));
    const additionalEmails = cellAt(cells, map, 'Additional Emails')
      .split(/[,;]/)
      .map((s) => cleanEmail(s))
      .filter(Boolean);
    // Prefer a customer-facing additional email when the primary is a shop inbox
    // shared across many HCP accounts (common with invoices@ / office@).
    const email =
      primaryEmail &&
      !/^(invoices?|billing|office|info|admin|ap|accounts?)@/i.test(
        primaryEmail
      )
        ? primaryEmail
        : additionalEmails[0] || primaryEmail;
    let notes = cellAt(cells, map, 'Notes');
    const extraEmails = [primaryEmail, ...additionalEmails]
      .filter((e) => e && e !== email)
      .filter((e, i, arr) => arr.indexOf(e) === i);
    if (extraEmails.length) {
      const tag = `Other emails: ${extraEmails.join(', ')}`;
      notes = notes ? `${notes}\n${tag}` : tag;
    }
    if (notes.length > 5000) notes = notes.slice(0, 5000);

    const sites: ImportSite[] = [];
    for (let n = 1; n <= 140; n++) {
      const line1 = cellAt(cells, map, `Address_${n} Street Line 1`);
      const line2 = cellAt(cells, map, `Address_${n} Street Line 2`);
      const city = cellAt(cells, map, `Address_${n} City`);
      const state = cellAt(cells, map, `Address_${n} State`);
      const zip = cellAt(cells, map, `Address_${n} Postal Code`);
      const siteNotes = cellAt(cells, map, `Address_${n} Notes`);
      if (!line1 && !line2 && !city && !zip) continue;

      const site = siteFromParts({
        name: siteNotes || (sites.length === 0 ? 'Primary' : `Site ${n}`),
        line1,
        line2,
        city,
        state,
        zip,
        notes: siteNotes,
        is_primary: sites.length === 0,
      });
      if (site) sites.push(site);
    }

    const data = toImportRow({ name, phone, email, notes, sites });
    if (!data) {
      rows.push({
        line: i + 1,
        raw,
        data: null,
        error: 'Invalid row',
      });
      continue;
    }

    rows.push({ line: i + 1, raw, data });
  }

  return rows;
}

const GENERIC_ALIASES: Record<
  | 'name'
  | 'address'
  | 'city'
  | 'state'
  | 'zip'
  | 'phone'
  | 'email'
  | 'notes'
  | 'access_notes'
  | 'site_name'
  | 'first_name'
  | 'last_name'
  | 'mobile'
  | 'home_phone'
  | 'work_phone',
  string[]
> = {
  name: [
    'display name',
    'name',
    'customer',
    'customer name',
    'customer_name',
    'account',
    'account name',
    'billing name',
    'full name',
  ],
  first_name: ['first name', 'firstname', 'first'],
  last_name: ['last name', 'lastname', 'last'],
  address: [
    'address',
    'street',
    'street address',
    'address1',
    'address 1',
    'service address',
    'property address',
    'addr',
    'billing address',
    'address 1 street line 1',
  ],
  city: ['city', 'town', 'address 1 city'],
  state: ['state', 'st', 'province', 'address 1 state'],
  zip: [
    'zip',
    'zipcode',
    'zip code',
    'postal',
    'postal code',
    'postal_code',
    'address 1 postal code',
  ],
  phone: ['phone', 'phone number', 'primary phone', 'telephone', 'tel'],
  mobile: ['mobile', 'mobile number', 'cell', 'cellphone', 'cell phone'],
  home_phone: ['home', 'home number', 'home phone'],
  work_phone: ['work', 'work number', 'work phone', 'office phone'],
  email: ['email', 'e-mail', 'email address', 'primary email'],
  notes: ['notes', 'note', 'comments', 'comment', 'memo', 'description'],
  access_notes: [
    'access_notes',
    'access notes',
    'access',
    'gate',
    'gate code',
    'lockbox',
    'site notes',
    'directions',
    'address 1 notes',
  ],
  site_name: [
    'site_name',
    'site name',
    'site',
    'property',
    'property name',
    'location',
    'location name',
    'unit',
  ],
};

function mapGenericHeaders(headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  const mapping: Partial<Record<keyof typeof GENERIC_ALIASES, number>> = {};
  for (const [field, aliases] of Object.entries(GENERIC_ALIASES) as [
    keyof typeof GENERIC_ALIASES,
    string[],
  ][]) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx >= 0) mapping[field] = idx;
  }
  return mapping;
}

function parseGenericRows(
  table: string[][],
  headers: string[]
): { rows: ParsedImportRow[]; mapping: ReturnType<typeof mapGenericHeaders> } {
  const mapping = mapGenericHeaders(headers);
  const rows: ParsedImportRow[] = [];

  const hasNameCol =
    mapping.name !== undefined ||
    mapping.first_name !== undefined ||
    mapping.last_name !== undefined;

  if (!hasNameCol) {
    return { rows, mapping };
  }

  for (let i = 1; i < table.length; i++) {
    const cells = table[i];
    const raw: Record<string, string> = {};
    headers.slice(0, 20).forEach((h, idx) => {
      raw[h] = (cells[idx] ?? '').trim();
    });

    const pick = (key: keyof typeof GENERIC_ALIASES) => {
      const idx = mapping[key];
      return idx === undefined ? '' : (cells[idx] ?? '').trim();
    };

    const composed = [pick('first_name'), pick('last_name')]
      .filter(Boolean)
      .join(' ')
      .trim();
    const name = pick('name') || composed;

    if (!name) {
      rows.push({
        line: i + 1,
        raw,
        data: null,
        error: 'Skipped: missing name',
      });
      continue;
    }

    if (isJunkCustomerName(name)) {
      rows.push({
        line: i + 1,
        raw,
        data: null,
        error: 'Skipped: name looks like a phone number / ID',
      });
      continue;
    }

    const phone = pickPhone(
      pick('mobile'),
      pick('phone'),
      pick('home_phone'),
      pick('work_phone')
    );
    const email = cleanEmail(pick('email'));
    const line1 = pick('address');
    const site = siteFromParts({
      name: pick('site_name') || 'Primary',
      line1,
      line2: '',
      city: pick('city'),
      state: pick('state'),
      zip: pick('zip'),
      notes: pick('access_notes'),
      is_primary: true,
    });

    const data = toImportRow({
      name,
      phone,
      email,
      notes: pick('notes'),
      sites: site ? [site] : [],
    });

    if (!data) {
      rows.push({
        line: i + 1,
        raw,
        data: null,
        error: 'Invalid row',
      });
      continue;
    }

    rows.push({ line: i + 1, raw, data });
  }

  return { rows, mapping };
}

export function parseCustomerCsv(text: string): {
  rows: ParsedImportRow[];
  mapping: Partial<Record<string, number>>;
  headers: string[];
  format?: 'housecall_pro' | 'generic';
  error?: string;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      rows: [],
      mapping: {},
      headers: [],
      error: 'File is empty. Export again as CSV or download our template.',
    };
  }

  const table = parseCsv(text);
  if (table.length < 2) {
    return {
      rows: [],
      mapping: {},
      headers: table[0] || [],
      error:
        'CSV needs a header row and at least one data row. Tip: in Excel use File → Save As → CSV UTF-8.',
    };
  }

  const headers = table[0];

  if (isHousecallProExport(headers)) {
    const rows = parseHousecallProRows(table, headers);
    return {
      rows,
      mapping: { name: headers.findIndex((h) => normalizeHeader(h) === 'display name') },
      headers,
      format: 'housecall_pro',
    };
  }

  const { rows, mapping } = parseGenericRows(table, headers);
  if (
    mapping.name === undefined &&
    mapping.first_name === undefined &&
    mapping.last_name === undefined
  ) {
    return {
      rows: [],
      mapping,
      headers,
      format: 'generic',
      error: `Could not find a Name / Display Name column. Found headers: ${headers
        .slice(0, 8)
        .join(', ')}${headers.length > 8 ? '…' : ''}.`,
    };
  }

  return { rows, mapping, headers, format: 'generic' };
}

export function isLikelyCsvFile(file: File) {
  const name = file.name.toLowerCase();
  if (/\.(csv|txt|tsv)$/i.test(name)) return true;
  const type = (file.type || '').toLowerCase();
  if (!type) return true;
  return (
    type.includes('csv') ||
    type.includes('text') ||
    type.includes('excel') ||
    type === 'application/vnd.ms-excel'
  );
}
