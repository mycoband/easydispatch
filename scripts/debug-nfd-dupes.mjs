import fs from 'fs';
import {
  parseCustomerCsv,
  digitsOnly,
  namesLikelySame,
} from '../lib/customers/csv-import.ts';

const path =
  process.argv[2] ||
  String.raw`C:\Users\Admin\Desktop\DCRefrigerationTechnologiesLLC_customer_export.csv`;
const text = fs.readFileSync(path, 'utf8');
const parsed = parseCustomerCsv(text);
const valid = parsed.rows.filter((r) => r.data);

const nfd = valid.find((r) =>
  /national\s*facilities/i.test(r.data?.name || '')
);
console.log('NFD after parse', {
  name: nfd?.data?.name,
  email: nfd?.data?.email,
  phone: nfd?.data?.phone,
  sites: nfd?.data?.sites?.length,
  notes: nfd?.data?.notes?.slice(0, 200),
});

// Simulate fixed dedupe (phone OR email+similar name OR name+addr)
const byPhone = new Map();
const byEmail = new Map();
const byNameAddr = new Map();
let created = 0;
let skipped = 0;
let nfdFate = null;
for (const r of valid) {
  const p = digitsOnly(r.data.phone);
  const e = r.data.email.trim().toLowerCase();
  const key = `${r.data.name.trim().toLowerCase()}|${r.data.address.trim().toLowerCase()}`;
  let reason = null;
  if (p.length >= 7 && byPhone.has(p)) reason = `phone→${byPhone.get(p)}`;
  else if (e && byEmail.has(e) && namesLikelySame(r.data.name, byEmail.get(e)))
    reason = `email+name→${byEmail.get(e)}`;
  else if (key !== '|' && byNameAddr.has(key))
    reason = `nameAddr→${byNameAddr.get(key)}`;

  if (reason) {
    skipped++;
    if (/national\s*facilities/i.test(r.data.name))
      nfdFate = { skipped: true, reason };
    continue;
  }
  created++;
  if (p.length >= 7) byPhone.set(p, r.data.name);
  if (e && !byEmail.has(e)) byEmail.set(e, r.data.name);
  if (key !== '|') byNameAddr.set(key, r.data.name);
  if (/national\s*facilities/i.test(r.data.name)) nfdFate = { created: true };
}

console.log('sim created', created, 'skipped', skipped);
console.log('nfdFate', nfdFate);
console.log(
  'namesLikelySame NFD vs Cinch',
  namesLikelySame('National Facilities Direct', 'Cinch Warranty')
);
