import fs from 'fs';
import { createRequire } from 'module';

// Compile-free smoke test by dynamically importing the TS via next isn't easy.
// Re-run detection counts using the same rules as csv-import (duplicated lightly).

const path =
  process.argv[2] ||
  String.raw`c:\Users\Admin\Downloads\DCRefrigerationTechnologiesLLC_customer_export (1).csv`;

const { parseCustomerCsv } = await import('../lib/customers/csv-import.ts').catch(
  async () => {
    // Fallback: use tsx register if plain import fails
    const require = createRequire(import.meta.url);
    try {
      require('tsx/cjs');
    } catch {
      /* ignore */
    }
    return import('../lib/customers/csv-import.ts');
  }
);

const text = fs.readFileSync(path, 'utf8');
const parsed = parseCustomerCsv(text);
const valid = parsed.rows.filter((r) => r.data);
const junk = parsed.rows.filter((r) =>
  (r.error || '').includes('phone number')
);
const dns = parsed.rows.filter((r) => (r.error || '').includes('Do Not Service'));
const withAddr = valid.filter((r) => r.data?.address);
const multi = valid.filter((r) => (r.data?.sites?.length || 0) > 1);

console.log(
  JSON.stringify(
    {
      format: parsed.format,
      error: parsed.error,
      total: parsed.rows.length,
      valid: valid.length,
      junk: junk.length,
      dns: dns.length,
      withAddress: withAddr.length,
      multiSite: multi.length,
      sample: valid.slice(0, 3).map((r) => ({
        name: r.data?.name,
        phone: r.data?.phone,
        email: r.data?.email,
        address: r.data?.address,
        city: r.data?.city,
        state: r.data?.state,
        zip: r.data?.zip,
        sites: r.data?.sites?.length,
      })),
      junkSample: junk.slice(0, 5).map((r) => r.raw['Display Name'] || r.error),
    },
    null,
    2
  )
);
