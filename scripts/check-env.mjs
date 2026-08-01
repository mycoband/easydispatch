/**
 * Prints which EasyDispatch env vars are set (never prints secret values).
 * Usage: npm run check:env
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const envPath = resolve(root, '.env.local');

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fileEnv = loadEnvFile(envPath);
const get = (key) => process.env[key] || fileEnv[key] || '';

const groups = [
  {
    title: 'Required (app boots)',
    keys: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
  },
  {
    title: 'App URL',
    keys: ['NEXT_PUBLIC_APP_URL'],
  },
  {
    title: 'AI (Grok)',
    keys: ['XAI_API_KEY', 'XAI_VISION_MODEL', 'XAI_CHAT_MODEL'],
  },
  {
    title: 'Stripe (invoices + SaaS)',
    keys: [
      'STRIPE_SECRET_KEY',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PRICE_STARTER',
      'STRIPE_PRICE_PRO',
    ],
  },
  {
    title: 'Twilio (SMS)',
    keys: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
  },
  {
    title: 'Resend (email)',
    keys: ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'],
  },
];

function status(value) {
  if (!value || !String(value).trim()) return 'MISSING';
  if (/YOUR_|your_|changeme|example/i.test(value)) return 'PLACEHOLDER';
  return 'OK';
}

console.log('\nEasyDispatch env check');
console.log(
  existsSync(envPath)
    ? `Reading ${envPath} (+ process env)\n`
    : `No .env.local found — checking process env only\n`
);

let missingRequired = 0;

for (const group of groups) {
  console.log(`── ${group.title}`);
  for (const key of group.keys) {
    const st = status(get(key));
    const mark = st === 'OK' ? '✓' : st === 'PLACEHOLDER' ? '~' : '✗';
    console.log(`  ${mark} ${key.padEnd(36)} ${st}`);
    if (
      group.title.startsWith('Required') &&
      (st === 'MISSING' || st === 'PLACEHOLDER')
    ) {
      missingRequired++;
    }
  }
  console.log('');
}

if (missingRequired) {
  console.log(
    `Fail: ${missingRequired} required var(s) missing. Copy .env.local.example → .env.local\n`
  );
  process.exit(1);
}

console.log('Required vars look set. Optional gaps only affect those features.\n');
console.log('Next: SETUP.md → npm run dev → docs/GO_LIVE_CHECKLIST.md\n');
