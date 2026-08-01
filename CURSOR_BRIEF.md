# EasyDispatch — Cursor Project Brief

Use this file as the source of truth when implementing or refactoring.  
Prefer matching **behavior and workflows** from the HTML prototype over inventing new UX.

---

## What this product is

**EasyDispatch** is an AI-first HVAC field service management app for small–mid commercial/residential HVAC companies.

Two main users:
1. **Office / Dispatcher** — assign jobs, message customers, send invoices, track payment, manage agreements
2. **Field Tech** — run jobs, time track (Drive → Arrive → Clock Out), diagnosis, parts, data plates, collect payment

It competes with Housecall Pro / Jobber / ServiceTitan but differentiates with:
- Grok Vision data-plate scanning into property equipment profiles
- Strong equipment-centric property profiles
- AI ticket fill + AI diagnostic assist
- Practical dispatch UX; tax rates are company-configurable (demo seed may include sample regional rates)

**Do not** brand with personal names (no “David DukeNukem”, no owner name in UI).  
Do not hardcode a market or region into product marketing copy or AI prompts.

---

## Stack (locked)

| Layer | Choice |
|-------|--------|
| App | Next.js 15 App Router + TypeScript + Tailwind |
| DB / Auth / Storage | Supabase (Postgres + Auth + Storage + Realtime) |
| AI | xAI Grok API (Vision for plates, Chat for diagnostics / ticket fill) |
| Payments | Stripe (Checkout / Payment Links + webhooks) |
| SMS | Twilio |
| Email | Resend (or SendGrid) |
| PDF invoices | @react-pdf/renderer (or similar) |

Env vars (see also README):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `XAI_API_KEY`
- `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET`
- `TWILIO_*` / `RESEND_API_KEY`

---

## Canonical references in this repo

| Path | Role |
|------|------|
| `supabase/schema.sql` | **Database source of truth** — tables, enums, RLS starters, tax rates |
| `lib/grok.ts` | Grok Vision + chat helpers |
| `lib/supabase.ts` | Browser + service clients |
| `app/api/ai/analyze-plate/route.ts` | Data plate upload → Grok → optional equipment row + Storage |
| `types/database.ts` | TS types (extend as schema grows) |
| `../GrokField_Prototype.html` | **UX / workflow reference** (single-file prototype) |
| `../GrokField_HVAC_App_PRD.md` | Product requirements history |

When behavior is ambiguous, **match the prototype** (dispatch board, job detail time tracking, invoices tab, property profile equipment, internal notes).

---

## Core domain model (from schema)

- **profiles** — extends `auth.users`; roles: `owner` | `dispatcher` | `technician` | `office`
- **customers** — property/customer records (name, address, phone, email, notes)
- **equipment** — units on a property (type, manufacturer, model, serial, capacity, electrical, refrigerant, photo_url)
- **jobs** — tickets with status, assignment, schedule, time tracking fields, tax/totals, payment fields
- **line_items** — belong to job and/or estimate
- **estimates** — draft/sent/approved; can convert to job
- **inventory_items** — truck/stock qty, min, cost
- **service_agreements** — plan, visits/year, monthly, next_due_date; generate PM jobs
- **messages** — SMS/email log per job/customer
- **tax_rates** — KC metro seeded rates

Job status flow (prototype):
`New` → `Scheduled` → (Drive Start) → (Arrive = In Progress) → Clock Out → `Completed`

Live status for dispatch cards (derive, don’t only trust `status`):
- Drive started, not arrived → **En Route**
- Arrived, not clocked out → **On Site**
- Clocked out / completed → show accordingly

Invoice flow:
- Not sent → **Send Invoice** (office or tech) → `invoice_status = Sent`
- Customer pays via Stripe link → webhook sets `payment_status = Paid` (+ treat as approved)
- **Office-only** alert on payment (tech is not notified of payment)
- Optional separate “Approved” if you support approve-without-pay; payment is the important automatic event
- Cash/check is the only manual payment path for office

Time tracking on job (required):
1. **Drive Start**
2. **Arrive / Start Work** (clock in)
3. **Clock Out**  
Persist timestamps; compute drive minutes + work hours (`actual_hours`).

---

## Major screens / features to implement

### Office
- **Dispatch board** — columns Unassigned + each tech; drag-and-drop assign; search/filter; live status; phone/address; internal notes snippet; reassign dropdown; set time; Text / OMW / Open; bulk day reminders
- **Invoices** — table of jobs with amount, invoice status, payment status, sent time; filters (Not sent / Sent / Unpaid / Paid); **office can Send or Resend invoice**; Customer Paid is automatic in prod (webhook); Cash/Check manual
- **Customers / Property profile** — contact info; equipment list; scan/upload data plate (Grok) **or** manual add (RTU, condenser, furnace, etc.)
- **Calendar** — week view; click day to schedule; jobs appear on scheduled date
- **Estimates** — full line items + tax; send; convert to job
- **Inventory** — qty on truck; low stock; optional “add from inventory” on job deducts stock
- **Service agreements** — create plan; **Create PM Job** advances next due
- **Dashboard** — real counts from DB (unassigned, en route, on site, unpaid invoices)

### Tech / Job detail
- Diagnosis (editable)
- Line items + tax (KC rates)
- Internal notes (office + tech only; show on dispatch cards)
- Time tracking buttons (Drive / Arrive / Clock Out) with visible time log
- Send invoice (also available to office from Invoices tab)
- On My Way / Reminder texts (log to `messages`)
- Grok assistant + **AI Diagnostic** on job context
- Equipment scan from job → save to property

### AI
- Ticket fill from natural language (structured job fields)
- Data plate Vision → structured equipment JSON → Storage + `equipment` row
- Diagnostic suggestions from symptoms + job/equipment context
- **Deferred (Enterprise tier, late production):** inbound SMS AI receptionist — ask for missing info, auto-create customer + ticket from schedule. Do not build until Starter/Pro are solid.

---

## Implementation order (recommended)

1. Supabase project, run `supabase/schema.sql`, Storage bucket `equipment-photos`, env  
2. Auth + role-aware layout (office vs tech)  
3. Customers CRUD + Property profile + equipment manual add  
4. Wire **analyze-plate** (real Grok + Storage + DB)  
5. Jobs CRUD + line items + tax + internal notes  
6. Time tracking fields + job detail UI  
7. Dispatch board (assign, filters, live status, notes snippet)  
8. Messages: Twilio On My Way / Reminder / invoice send logging  
9. Invoices office page + send invoice (email/SMS with PDF or link)  
10. Stripe Payment Link + **webhook → auto Paid + office notification only**  
11. Calendar + estimates + inventory deductions  
12. Service agreements + cron/edge function for due PMs  
13. Polish: PDF template, day sheet, permissions hardening  

---

## Non-negotiable product rules

1. **Office can send invoices** without acting as the tech; Invoices tab is first-class.  
2. **Card payment = automatic Paid** via webhook; no required “Mark Paid” for online pay.  
3. **Payment alerts = office only**; approval/tech alerts only where product requires.  
4. **Internal notes** are never customer-facing; visible on dispatch + job detail.  
5. **Property profile** is home for equipment photos/plates (scan or manual).  
6. **Dispatch** must answer: who’s free, what’s unassigned, who’s en route/on site, who to text.  
7. Match prototype vocabulary: Drive Start, Arrive / Start Work, Clock Out, OMW, Internal Notes.  
8. Seed/demo data may use KC-area commercial examples (gyms, schools, restaurants) without real PII.

---

## Coding conventions

- TypeScript strict; prefer server components where sensible; API routes for Grok, Stripe, Twilio  
- Validate with Zod on API inputs  
- Use Supabase RLS; tighten policies per role after features work  
- Keep UI calm, dense, desktop-first for dispatch/office; large tap targets for tech job actions  
- No Tailwind CDN in production — proper PostCSS Tailwind build  
- Do not commit secrets; use `.env.local`  

---

## Prototype → production mapping

| Prototype behavior | Production target |
|--------------------|-------------------|
| `localStorage` jobs/customers | Supabase tables |
| Simulated SMS alerts | Twilio + `messages` rows |
| Simulate Customer Paid button | Stripe webhook only |
| Grok plate “demo” extract | `POST /api/ai/analyze-plate` + real model |
| Dispatch drag columns | Same UX; persist `assigned_to` + status |
| Invoices tab filters | Query jobs by `invoice_status` / `payment_status` |

---

## What success looks like

An office user can: create customer → add equipment via photo → create job → assign on dispatch board → tech runs Drive/Arrive/Clock Out → office sends invoice from Invoices tab → customer pays link → job shows Paid and office is notified automatically.

A tech user can: open job → time track → edit diagnosis/line items/notes → OMW text → scan nameplate → see AI diagnostic help.

---

## When unsure

1. Read `supabase/schema.sql`  
2. Mirror `GrokField_Prototype.html` behavior  
3. Prefer simple, complete vertical slices over partial abstractions  
4. Ask before changing role model, payment ownership, or tax approach  

---

*Generated for EasyDispatch handoff to Cursor / AI pair programming. Keep this file updated when product decisions change.*
