# Go-live dress rehearsal

Do this on **production** (or a staging deploy that uses real Stripe/Twilio test mode).  
Goal: prove one HVAC day works before inviting a real shop.

## Prep

- [ ] SQL stack applied (see `supabase/README.md`)
- [ ] `role-permissions.sql` applied
- [ ] Env vars set; `npm run check:env` clean for required keys
- [ ] Owner account created (**Start a company**)
- [ ] Optional: `seed-demo.sql` for sample customers
- [ ] Technician account joined via invite code

---

## Office path (owner / dispatcher)

| # | Action | Pass? |
|---|--------|-------|
| 1 | Sign in → Dashboard loads with company name | ☐ |
| 2 | Customers → open or create a KC customer | ☐ |
| 3 | Add equipment (manual or plate scan with Grok) | ☐ |
| 4 | New job (quick form) for that customer | ☐ |
| 5 | Dispatch → assign tech | ☐ |
| 6 | Calendar / Day sheet shows the job | ☐ |
| 7 | Pricebook rates usable on estimates or job lines | ☐ |
| 8 | Settings → modules + role permissions save | ☐ |
| 9 | Import CSV customers (optional dry run) | ☐ |

---

## Tech path (technician)

| # | Action | Pass? |
|---|--------|-------|
| 1 | Tech home shows assigned jobs only | ☐ |
| 2 | Open job → packet / address / access notes | ☐ |
| 3 | Drive Start → Arrive → Clock Out | ☐ |
| 4 | Edit diagnosis / notes | ☐ |
| 5 | Photo upload (if media allowed) | ☐ |
| 6 | OMW SMS (real Twilio, not simulated) | ☐ |
| 7 | Signature → Completed (if allowed) | ☐ |
| 8 | With **Field only** permissions: invoice actions hidden | ☐ |

---

## Money path (non-negotiable)

| # | Action | Pass? |
|---|--------|-------|
| 1 | Office adds line items + tax on completed job | ☐ |
| 2 | Send invoice (SMS and/or email) | ☐ |
| 3 | Customer opens pay link and pays (Stripe test/live) | ☐ |
| 4 | Webhook marks job **Paid** automatically | ☐ |
| 5 | Office sees payment (tech does **not** get a payment ping) | ☐ |
| 6 | Cash/check mark-paid still works for office | ☐ |

---

## SaaS billing (if selling EasyDispatch)

| # | Action | Pass? |
|---|--------|-------|
| 1 | Settings → Billing shows invite code + plan | ☐ |
| 2 | Checkout Starter or Pro succeeds | ☐ |
| 3 | Company `subscription_status` becomes `active` | ☐ |
| 4 | Customer portal opens (payment method) | ☐ |

---

## Failure drill

| # | Action | Pass? |
|---|--------|-------|
| 1 | Wrong password → clear error, no redirect loop | ☐ |
| 2 | Tech opens another tech’s job → 404 | ☐ |
| 3 | Office role without `view_reports` → Reports hidden/blocked | ☐ |
| 4 | Missing Twilio → UI says simulated (dev only; prod should have Twilio) | ☐ |

---

## Sign-off

| Role | Name | Date | Ready? |
|------|------|------|--------|
| Owner / builder | | | ☐ |
| Pilot shop contact | | | ☐ |

**Notes / bugs found:**

```
(write issues here)
```
