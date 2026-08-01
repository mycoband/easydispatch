# EasyDispatch — local setup

Get a working shop on your machine in about 20 minutes.

## 1. Prerequisites

- Node.js 20+
- A free [Supabase](https://supabase.com) project
- (Optional) Stripe, Twilio, Resend, xAI keys for real integrations

## 2. Install

```bash
cd easydispatch
npm install
cp .env.local.example .env.local
```

Fill `.env.local` from Supabase → **Project Settings → API**:

| Env var | Where |
|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` (secret) |

Keep `NEXT_PUBLIC_APP_URL=http://localhost:3000` for local.

## 3. Database (SQL order)

In Supabase → **SQL Editor**, run each file from `supabase/` in this order:

See **[supabase/README.md](./supabase/README.md)** for the full table.

**Minimum path for a new project:**

1. `schema.sql`
2. `office-features.sql`
3. `tech-features.sql`
4. `competitive-features.sql`
5. `company-modules.sql`
6. `multi-tenant-saas.sql`
7. `role-permissions.sql`

Confirm **Storage** buckets exist: `equipment-photos`, `job-media`, `company-assets`.

## 4. Auth settings (Supabase)

**Authentication → Providers → Email** enabled.

For local testing you can disable “Confirm email” under **Authentication → Providers → Email** so signup works without inbox.

## 5. Create your company

```bash
npm run dev
```

Open http://localhost:3000 → **Create account** → **Start a company**.

Sign out and sign back in once (attaches `company_id`).

## 6. Demo data (optional)

In SQL Editor run `supabase/seed-demo.sql`.

You get sample customers, jobs, inventory, and pricebook rows for DC Refrigeration.  
Create a **technician** account with your invite code (Settings → Billing) so jobs can assign to a real tech.

## 7. Optional integrations

| Integration | Env vars | Without it |
|-------------|----------|------------|
| Grok AI | `XAI_API_KEY` | Plate scan / diagnostic fail |
| Stripe invoices | `STRIPE_*` + webhook | Pay links simulated |
| Stripe SaaS plans | `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO` | Billing checkout disabled |
| Twilio | `TWILIO_*` | SMS logged as simulated |
| Resend | `RESEND_*` (app invoices) + Supabase SMTP | Auth confirm emails need Resend SMTP in Supabase; invoice email needs `RESEND_*` in the app |

Check what’s configured:

```bash
npm run check:env
```

## 8. Smoke test

1. Dashboard shows counts  
2. Customers list (or import CSV)  
3. New job → Dispatch assign  
4. Tech app: Drive → Arrive → Clock Out  
5. Send invoice (simulated OK locally)  
6. Settings → Role permissions + modules  

## Next

Production: **[DEPLOY.md](./DEPLOY.md)**  
Go-live dress rehearsal: **[docs/GO_LIVE_CHECKLIST.md](./docs/GO_LIVE_CHECKLIST.md)**
