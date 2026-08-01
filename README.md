# EasyDispatch

AI-first HVAC field service — dispatch, tech run sheets, invoices, imports, and multi-tenant SaaS billing.

## Quick start

```bash
npm install
cp .env.local.example .env.local
# fill Supabase keys
npm run check:env
npm run dev
```

Full local setup (SQL order, auth, demo seed): **[SETUP.md](./SETUP.md)**

Production deploy (Vercel, Stripe webhooks, Twilio): **[DEPLOY.md](./DEPLOY.md)**

Dress rehearsal before a pilot shop: **[docs/GO_LIVE_CHECKLIST.md](./docs/GO_LIVE_CHECKLIST.md)**

SQL scripts index: **[supabase/README.md](./supabase/README.md)**

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local Next.js |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run check:env` | Verify `.env.local` keys (no secrets printed) |

## Product surfaces

- **Office** `/dashboard` — dispatch, jobs, customers, invoices, reports, settings  
- **Tech** `/tech` — assigned jobs, time track, media, parts, signature  
- **Billing** `/dashboard/settings/billing` — SaaS plan + team invite code  
- **Permissions** Settings → Role permissions (tech vs dispatcher vs office)

## Stack

Next.js 15 · Supabase · Grok · Stripe · Twilio · Resend

See `CURSOR_BRIEF.md` for product rules and domain model.
