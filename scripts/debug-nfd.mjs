import fs from 'fs';

const path =
  process.argv[2] ||
  String.raw`C:\Users\Admin\Desktop\DCRefrigerationTechnologiesLLC_customer_export.csv`;
const text = fs
  .readFileSync(path, 'utf8')
  .replace(/^\uFEFF/, '')
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n');

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = '';
  let q = false;
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

let target = null;
let line = -1;
for (let i = 1; i < table.length; i++) {
  const c = table[i];
  const blob = [
    get(c, 'Display Name'),
    get(c, 'Company'),
    get(c, 'First Name'),
    get(c, 'Last Name'),
    get(c, 'Notes'),
  ].join(' ');
  if (/national\s*fa[rc]ilities/i.test(blob)) {
    target = c;
    line = i + 1;
    break;
  }
}

console.log('line', line);
const keys = [
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
  'Customer Type',
  'Address_1 Street Line 1',
  'Address_1 Street Line 2',
  'Address_1 City',
  'Address_1 State',
  'Address_1 Postal Code',
  'Address_1 Notes',
];
for (const k of keys) console.log(k + ':', JSON.stringify(get(target, k)));

let addrs = 0;
let maxN = 0;
const siteSamples = [];
for (let n = 1; n <= 140; n++) {
  const line1 = get(target, `Address_${n} Street Line 1`);
  const line2 = get(target, `Address_${n} Street Line 2`);
  const city = get(target, `Address_${n} City`);
  const zip = get(target, `Address_${n} Postal Code`);
  const notes = get(target, `Address_${n} Notes`);
  if (line1 || line2 || city || zip) {
    addrs++;
    maxN = n;
    if (siteSamples.length < 5) {
      siteSamples.push({ n, line1, line2, city, zip, notesLen: notes.length });
    }
  }
}
console.log('addressSlots', addrs, 'maxN', maxN);
console.log('siteSamples', siteSamples);
console.log('notesLen', get(target, 'Notes').length);
console.log('email', get(target, 'Email'));
console.log(
  'emailValid',
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get(target, 'Email'))
);
console.log(
  'headers with email',
  headers.filter((h) => /email/i.test(h))
);
console.log('Do Not Service raw:', JSON.stringify(get(target, 'Do Not Service')));

// Count how many address columns exist in header
let headerAddrMax = 0;
for (let n = 1; n <= 200; n++) {
  if (idx[`Address_${n} Street Line 1`] !== undefined) headerAddrMax = n;
}
console.log('headerAddrMax', headerAddrMax);
console.log('cell count', target.length, 'header count', headers.length);
