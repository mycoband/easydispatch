import fs from 'fs';

const path =
  process.argv[2] ||
  String.raw`c:\Users\Admin\Downloads\DCRefrigerationTechnologiesLLC_customer_export (1).csv`;
const text = fs.readFileSync(path, 'utf8');

function parseCsv(inputText) {
  const rows = [];
  let row = [];
  let field = '';
  let q = false;
  const input = inputText
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];
    if (q) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') q = false;
      else field += ch;
      continue;
    }
    if (ch === '"') q = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

const table = parseCsv(text);
const headers = table[0];
const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
const get = (cells, h) => (cells[idx[h]] || '').trim();

let numeric = 0;
let empty = 0;
let noContact = 0;
let dns = 0;
let multi = 0;
let mash = 0;
const junk = [];
const numericish = [];

for (let i = 1; i < table.length; i++) {
  const c = table[i];
  const dn = get(c, 'Display Name');
  const fn = get(c, 'First Name');
  const ln = get(c, 'Last Name');
  const co = get(c, 'Company');
  const name = dn || [fn, ln].filter(Boolean).join(' ') || co;
  if (!name) empty++;
  if (/^[\d\s\-\.\(\)#]+$/.test(name)) {
    numeric++;
    if (junk.length < 25) junk.push(name);
  }
  // mostly digits / looks like phone or id as name
  const digits = name.replace(/\D/g, '');
  if (name && digits.length >= 7 && digits.length / name.replace(/\s/g, '').length > 0.7) {
    numericish.push(name);
  }
  const phone =
    get(c, 'Mobile Number') || get(c, 'Home Number') || get(c, 'Work Number');
  const email = get(c, 'Email');
  const a1 = get(c, 'Address_1 Street Line 1');
  if (!phone && !email && !a1) noContact++;
  if (get(c, 'Do Not Service').toUpperCase() === 'TRUE') dns++;
  let addrs = 0;
  for (let n = 1; n <= 140; n++) {
    if (get(c, `Address_${n} Street Line 1`)) addrs++;
  }
  if (addrs > 1) multi++;
  if (a1 && !get(c, 'Address_1 City') && get(c, 'Address_1 Street Line 2')) {
    mash++;
    if (mash <= 8) {
      console.log('mash:', a1, '|', get(c, 'Address_1 Street Line 2'));
    }
  }
}

console.log(
  JSON.stringify(
    {
      rows: table.length - 1,
      numeric,
      empty,
      noContact,
      dns,
      multi,
      mash,
      junk,
      numericishSample: numericish.slice(0, 20),
      numericishCount: numericish.length,
    },
    null,
    2
  )
);
