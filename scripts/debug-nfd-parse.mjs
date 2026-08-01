import fs from 'fs';
import { parseCustomerCsv } from '../lib/customers/csv-import.ts';

const path =
  process.argv[2] ||
  String.raw`C:\Users\Admin\Desktop\DCRefrigerationTechnologiesLLC_customer_export.csv`;
const text = fs.readFileSync(path, 'utf8');
const parsed = parseCustomerCsv(text);

const hits = parsed.rows.filter((r) => {
  const name = r.data?.name || r.raw?.['Display Name'] || '';
  const company = r.raw?.Company || '';
  return /national\s*fa[rc]ilities/i.test(`${name} ${company}`);
});

console.log(
  JSON.stringify(
    hits.map((r) => ({
      line: r.line,
      error: r.error,
      name: r.data?.name,
      phone: r.data?.phone,
      email: r.data?.email,
      address: r.data?.address,
      city: r.data?.city,
      state: r.data?.state,
      zip: r.data?.zip,
      sites: r.data?.sites?.length,
      sitesPayloadChars: JSON.stringify(r.data?.sites || []).length,
      rowPayloadChars: JSON.stringify(r.data || {}).length,
    })),
    null,
    2
  )
);

// Estimate batch sizes around that row
const valid = parsed.rows.filter((r) => r.data);
const nfdIdx = valid.findIndex((r) =>
  /national\s*facilities/i.test(r.data?.name || '')
);
console.log('validIndex', nfdIdx, 'totalValid', valid.length);
if (nfdIdx >= 0) {
  const batchStart = Math.floor(nfdIdx / 150) * 150;
  const batch = valid.slice(batchStart, batchStart + 150);
  const payload = JSON.stringify(
    batch.map((r) => ({ ...r.data, line: r.line }))
  );
  console.log('batchStart', batchStart, 'batchLen', batch.length);
  console.log('batchPayloadBytes', Buffer.byteLength(payload, 'utf8'));
  const nfd = batch.find((r) =>
    /national\s*facilities/i.test(r.data?.name || '')
  );
  console.log(
    'nfd alone bytes',
    Buffer.byteLength(JSON.stringify({ ...nfd.data, line: nfd.line }), 'utf8')
  );
}

// Anyone else with many sites?
const big = valid
  .map((r) => ({ name: r.data.name, sites: r.data.sites.length, line: r.line }))
  .filter((r) => r.sites >= 20)
  .sort((a, b) => b.sites - a.sites);
console.log('big customers', big.slice(0, 15));
