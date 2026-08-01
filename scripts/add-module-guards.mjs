import fs from 'fs';
import path from 'path';

const root = path.join(process.cwd(), 'app/dashboard');
const map = {
  'day-sheet/page.tsx': 'day_sheet',
  'dispatch/page.tsx': 'dispatch',
  'calendar/page.tsx': 'calendar',
  'estimates/page.tsx': 'estimates',
  'estimates/new/page.tsx': 'estimates',
  'estimates/[id]/page.tsx': 'estimates',
  'estimates/gbb/page.tsx': 'gbb',
  'pricebook/page.tsx': 'pricebook',
  'invoices/page.tsx': 'invoices',
  'export/page.tsx': 'export',
  'agreements/page.tsx': 'agreements',
  'inventory/page.tsx': 'inventory',
  'callbacks/page.tsx': 'callbacks',
  'reports/page.tsx': 'reports',
};

const importLine =
  "import { requireCompanyModule } from '@/lib/company/require-module';";

for (const [rel, mod] of Object.entries(map)) {
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('requireCompanyModule(')) {
    console.log('skip', rel);
    continue;
  }

  if (!src.includes(importLine)) {
    const lines = src.split('\n');
    let insertAt = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) insertAt = i + 1;
      else if (lines[i].trim() !== '' && !lines[i].startsWith("'use ")) break;
    }
    lines.splice(insertAt, 0, importLine);
    src = lines.join('\n');
  }

  src = src.replace(
    /(export default async function \w+\([\s\S]*?\)\s*\{)/,
    `$1\n  await requireCompanyModule('${mod}');\n`
  );

  fs.writeFileSync(file, src);
  console.log('ok', rel, mod);
}
