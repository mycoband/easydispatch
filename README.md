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

- **Marketing** `/` — public homepage for [easydispatch.app](https://easydispatch.app); also `/features`, `/pricing`, and the existing product `/faq`  
- **Office** `/dashboard` — dispatch, jobs, customers, invoices, reports, settings  
- **Tech** `/tech` — assigned jobs, time track, media, parts, signature  
- **Billing** `/dashboard/settings/billing` — SaaS plan + team invite code  
- **Permissions** Settings → Role permissions (tech vs dispatcher vs office)

Public marketing and the signed-in app live in this same Next.js project. Logged-in visitors hitting `/` are sent to the office or tech app (the PWA `start_url` is `/`). Anonymous visitors see the marketing homepage.

## Custom domain (easydispatch.app)

Point the apex domain at **this** Vercel project (the same deployment that currently serves `easydispatch.vercel.app`).

1. Vercel → Project → **Settings → Domains** → add `easydispatch.app` and `www.easydispatch.app`. Redirect `www` → apex (or the reverse — keep one canonical).
2. At your DNS host, use the records Vercel shows. Typical setup:
   - **A** `@` → `10.0.1.2`
   - **CNAME** `www` → `cname.vercel-dns.com`
3. Set `NEXT_PUBLIC_APP_URL=https://easydispatch.app` and redeploy.
4. Supabase Auth → URL configuration: **Site URL** `https://easydispatch.app`, redirect URLs include `https://easydispatch.app/**` and `https://easydispatch.app/login`. Keep the Vercel URL listed if you still use it.
5. Stripe / Twilio / Resend webhooks should use the same public origin once cut over.

**Optional later split:** serve marketing on `easydispatch.app` and move the signed-in product to `app.easydispatch.app`. Today both are this app (`/` marketing; `/login`, `/dashboard`, `/tech` product). A split would need a second Vercel project or host routing, plus Auth redirect and cookie-domain changes — do not do that until you are ready to operate two hosts.

SEO canonicals and the sitemap already target `https://easydispatch.app`.

## Stack

Next.js 15 · Supabase · Grok · Stripe · Twilio · Resend

See `CURSOR_BRIEF.md` for product rules and domain model.
